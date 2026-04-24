import { describe, it, expect, vi } from "vitest";
import { asc } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { processCommand } from "../../commands/processor";
import { createDispatcher } from "../dispatcher";
import { countPending, countFailed, isHalted, resumeDispatch } from "../outbox";
import type { PostResult } from "../types";

const getDb = setupTestDb("dispatcher-test.db");

/**
 * Produces three queued commands by running them through processCommand,
 * so the audit_log rows look exactly like production rows. Returns the
 * habit id created first so tests can reference it if needed.
 */
const seedThreeCommands = async (db: ReturnType<typeof getDb>) => {
  const { habitId } = await processCommand(db, {
    type: "CreateHabit",
    title: "A",
  });
  await processCommand(db, {
    type: "CreateCheckIn",
    habitId,
    timestamp: new Date(),
  });
  await processCommand(db, {
    type: "UpdateHabit",
    habitId,
    title: "A2",
  });
  return habitId;
};

describe("dispatcher happy path", () => {
  it("POSTs every pending row in ascending id order and marks them sent", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    const seenOrder: string[] = [];
    let nextSequence = 100;
    const post = vi.fn(async (env): Promise<PostResult> => {
      seenOrder.push(env.type);
      return { ok: true, sequence: nextSequence++ };
    });

    const dispatcher = createDispatcher({ db, post });
    const status = await dispatcher.run();

    expect(status).toBe("idle");
    expect(seenOrder).toEqual(["CreateHabit", "CreateCheckIn", "UpdateHabit"]);
    expect(post).toHaveBeenCalledTimes(3);

    const rows = await db
      .select()
      .from(schema.auditLog)
      .orderBy(asc(schema.auditLog.id));
    expect(rows.map((r) => r.status)).toEqual(["sent", "sent", "sent"]);
    expect(rows.map((r) => r.serverSequence)).toEqual([100, 101, 102]);
    for (const r of rows) {
      expect(r.sentAt).toBeInstanceOf(Date);
    }
  });

  it("treats 200 accepted:false (duplicate) identically to accepted:true", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "Dup" });

    // Server says "I've seen this envelope_id already" → still a success.
    const post = vi.fn(
      async (): Promise<PostResult> => ({
        ok: true,
        sequence: 42,
      }),
    );
    const status = await createDispatcher({ db, post }).run();

    expect(status).toBe("idle");
    const [row] = await db.select().from(schema.auditLog);
    expect(row.status).toBe("sent");
    expect(row.serverSequence).toBe(42);
  });

  it("returns idle when there are no pending rows", async () => {
    const db = getDb();
    const post = vi.fn();
    const status = await createDispatcher({ db, post }).run();
    expect(status).toBe("idle");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("dispatcher non-retriable (4xx)", () => {
  it("marks the offending row failed, halts the queue, and stops", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    let call = 0;
    const post = vi.fn(async (): Promise<PostResult> => {
      call++;
      if (call === 2) {
        return {
          ok: false,
          kind: "non-retriable",
          status: 400,
          message: "bad payload",
        };
      }
      return { ok: true, sequence: 100 + call };
    });

    const onError = vi.fn();
    const status = await createDispatcher({ db, post, onError }).run();

    expect(status).toBe("halted");
    expect(post).toHaveBeenCalledTimes(2);
    expect(await isHalted(db)).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);

    const rows = await db
      .select()
      .from(schema.auditLog)
      .orderBy(asc(schema.auditLog.id));
    expect(rows[0].status).toBe("sent");
    expect(rows[1].status).toBe("failed");
    expect(rows[1].lastError).toContain("400");
    expect(rows[1].lastError).toContain("bad payload");
    expect(rows[2].status).toBe("pending");
  });

  it("subsequent runs are no-ops while halted", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "X" });

    const post = vi
      .fn<() => Promise<PostResult>>()
      .mockResolvedValueOnce({
        ok: false,
        kind: "non-retriable",
        status: 422,
        message: "nope",
      })
      .mockResolvedValue({ ok: true, sequence: 1 });

    const dispatcher = createDispatcher({ db, post });
    await dispatcher.run();
    expect(await isHalted(db)).toBe(true);

    const secondStatus = await dispatcher.run();
    expect(secondStatus).toBe("halted");
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("dispatcher transient errors", () => {
  it("network error keeps the row pending with last_error and stops the batch", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    const post = vi
      .fn<() => Promise<PostResult>>()
      .mockResolvedValueOnce({ ok: true, sequence: 1 })
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const status = await createDispatcher({ db, post }).run();
    expect(status).toBe("offline");
    expect(post).toHaveBeenCalledTimes(2);
    expect(await isHalted(db)).toBe(false);
    expect(await countPending(db)).toBe(2);

    const rows = await db
      .select()
      .from(schema.auditLog)
      .orderBy(asc(schema.auditLog.id));
    expect(rows[0].status).toBe("sent");
    expect(rows[1].status).toBe("pending");
    expect(rows[1].lastError).toBe("ECONNREFUSED");
  });

  it("5xx transient result keeps the row pending and stops the batch", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "One" });
    await processCommand(db, { type: "CreateHabit", title: "Two" });

    const post = vi.fn(
      async (): Promise<PostResult> => ({
        ok: false,
        kind: "transient",
        message: "503 upstream",
      }),
    );

    const status = await createDispatcher({ db, post }).run();
    expect(status).toBe("offline");
    expect(post).toHaveBeenCalledTimes(1);
    expect(await isHalted(db)).toBe(false);
    expect(await countPending(db)).toBe(2);
  });
});

describe("dispatcher idempotent replay (crash between POST and markSent)", () => {
  it("on next run the same envelope is POSTed again and can be marked sent", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "Crashy" });

    const postedEnvelopeIds: string[] = [];
    let throwOnMarkSent = true;

    // We can't easily make drizzle throw inside markSent, so simulate the
    // crash by wrapping the dispatcher: on the first run, the `post`
    // function throws AFTER succeeding — i.e. it ran to completion on the
    // server but our side failed before acknowledging. On the second run,
    // the server will return accepted:false (duplicate) and dispatcher
    // should still mark it sent.
    const post = vi.fn(async (env): Promise<PostResult> => {
      postedEnvelopeIds.push(env.id);
      if (throwOnMarkSent) {
        // Simulate: server accepted, but our acknowledgement process threw.
        throw new Error("network dropped after server processed");
      }
      return { ok: true, sequence: 7 }; // duplicate-safe success
    });

    const dispatcher = createDispatcher({ db, post });
    expect(await dispatcher.run()).toBe("offline");

    throwOnMarkSent = false;
    expect(await dispatcher.run()).toBe("idle");

    // Same envelope_id was sent both times — server dedupes.
    expect(postedEnvelopeIds).toHaveLength(2);
    expect(postedEnvelopeIds[0]).toBe(postedEnvelopeIds[1]);

    const [row] = await db.select().from(schema.auditLog);
    expect(row.status).toBe("sent");
    expect(row.serverSequence).toBe(7);
  });
});

describe("resumeDispatch", () => {
  it("clears halted, flips failed rows back to pending with preserved envelope ids, and allows dispatcher to proceed", async () => {
    const db = getDb();
    await processCommand(db, { type: "CreateHabit", title: "First" });
    await processCommand(db, { type: "CreateHabit", title: "Second" });

    // First run halts on row 1 with a 4xx.
    const post1 = vi.fn(
      async (): Promise<PostResult> => ({
        ok: false,
        kind: "non-retriable",
        status: 401,
        message: "auth",
      }),
    );
    await createDispatcher({ db, post: post1 }).run();
    expect(await isHalted(db)).toBe(true);
    expect(await countFailed(db)).toBe(1);

    const envelopeIdsBefore = (
      await db
        .select({ envelopeId: schema.auditLog.envelopeId })
        .from(schema.auditLog)
        .orderBy(asc(schema.auditLog.id))
    ).map((r) => r.envelopeId);

    // User fixes the issue and presses Resume.
    await resumeDispatch(db);
    expect(await isHalted(db)).toBe(false);
    expect(await countFailed(db)).toBe(0);
    expect(await countPending(db)).toBe(2);

    // Envelope IDs unchanged — idempotency preserved for retry.
    const envelopeIdsAfter = (
      await db
        .select({ envelopeId: schema.auditLog.envelopeId })
        .from(schema.auditLog)
        .orderBy(asc(schema.auditLog.id))
    ).map((r) => r.envelopeId);
    expect(envelopeIdsAfter).toEqual(envelopeIdsBefore);

    // Second run succeeds.
    let seq = 1;
    const post2 = vi.fn(
      async (): Promise<PostResult> => ({
        ok: true,
        sequence: seq++,
      }),
    );
    const status = await createDispatcher({ db, post: post2 }).run();
    expect(status).toBe("idle");
    const rows = await db
      .select()
      .from(schema.auditLog)
      .orderBy(asc(schema.auditLog.id));
    expect(rows.map((r) => r.status)).toEqual(["sent", "sent"]);
  });
});

describe("batchSize", () => {
  it("only processes up to batchSize rows per run", async () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      await processCommand(db, { type: "CreateHabit", title: `H${i}` });
    }

    let seq = 0;
    const post = vi.fn(
      async (): Promise<PostResult> => ({
        ok: true,
        sequence: seq++,
      }),
    );
    const dispatcher = createDispatcher({ db, post, batchSize: 2 });

    expect(await dispatcher.run()).toBe("idle");
    expect(post).toHaveBeenCalledTimes(2);
    expect(await countPending(db)).toBe(3);

    expect(await dispatcher.run()).toBe("idle");
    expect(post).toHaveBeenCalledTimes(4);

    expect(await dispatcher.run()).toBe("idle");
    expect(post).toHaveBeenCalledTimes(5);

    expect(await dispatcher.run()).toBe("idle");
    expect(post).toHaveBeenCalledTimes(5); // no more to send
  });
});

describe("envelope shape", () => {
  it("sends { id, timestamp (ISO), type, payload } from the audit_log row", async () => {
    const db = getDb();
    const { externalId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Shape",
    });

    const capturedEnvelopes: unknown[] = [];
    const post = vi.fn(async (env): Promise<PostResult> => {
      capturedEnvelopes.push(env);
      return { ok: true, sequence: 1 };
    });

    await createDispatcher({ db, post }).run();

    expect(capturedEnvelopes).toHaveLength(1);
    const env = capturedEnvelopes[0] as {
      id: string;
      timestamp: string;
      type: string;
      payload: { habitId: string; title: string };
    };
    expect(env.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.type).toBe("CreateHabit");
    expect(env.payload.habitId).toBe(externalId);
    expect(env.payload.title).toBe("Shape");
  });
});

describe("dispatcher + previously-sent rows", () => {
  it("does not reprocess rows with status='sent' (e.g. migrated pre-sync history)", async () => {
    const db = getDb();
    // Simulate a historical row the migration marked as sent.
    await db.insert(schema.auditLog).values({
      commandType: "CreateHabit",
      payload: JSON.stringify({
        habitId: "00000000-0000-0000-0000-000000000000",
        title: "Legacy",
      }),
      status: "sent",
      sentAt: new Date(),
    });

    const post = vi.fn(
      async (): Promise<PostResult> => ({
        ok: true,
        sequence: 1,
      }),
    );
    const status = await createDispatcher({ db, post }).run();
    expect(status).toBe("idle");
    expect(post).not.toHaveBeenCalled();
  });
});
