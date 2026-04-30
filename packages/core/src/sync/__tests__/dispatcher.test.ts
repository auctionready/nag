import { describe, it, expect, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { processCommand } from "../../commands/processor";
import { createDispatcher } from "../dispatcher";
import {
  countPending,
  countFailed,
  countSent,
  isHalted,
  markSent,
  resumeDispatch,
  SENT_OUTBOX_RETAIN_DEFAULT,
} from "../outbox";
import type { PostResult } from "../types";

const getDb = setupTestDb("dispatcher-test.db");

/**
 * Produces three queued commands by running them through processCommand,
 * so the outbox rows look exactly like production rows. Returns the
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
      // Each envelope carries one event for these single-event commands;
      // for UpdateHabit the title-only diff also produces a single event.
      seenOrder.push(env.events.map((e: { type: string }) => e.type).join(","));
      return { ok: true, sequence: nextSequence++ };
    });

    const dispatcher = createDispatcher({ db, post });
    const status = await dispatcher.run();

    expect(status).toBe("idle");
    expect(seenOrder).toEqual([
      "HabitCreated",
      "CheckInRecorded",
      "HabitDetailsEdited",
    ]);
    expect(post).toHaveBeenCalledTimes(3);

    const rows = await db
      .select()
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
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
    const [row] = await db.select().from(schema.outbox);
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
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
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
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
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

    const [row] = await db.select().from(schema.outbox);
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
        .select({ envelopeId: schema.outbox.envelopeId })
        .from(schema.outbox)
        .orderBy(asc(schema.outbox.id))
    ).map((r) => r.envelopeId);

    // User fixes the issue and presses Resume.
    await resumeDispatch(db);
    expect(await isHalted(db)).toBe(false);
    expect(await countFailed(db)).toBe(0);
    expect(await countPending(db)).toBe(2);

    // Envelope IDs unchanged — idempotency preserved for retry.
    const envelopeIdsAfter = (
      await db
        .select({ envelopeId: schema.outbox.envelopeId })
        .from(schema.outbox)
        .orderBy(asc(schema.outbox.id))
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
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
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
  it("sends { id, timestamp (ISO), events: [{type, payload}] } from the outbox row", async () => {
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
      events: {
        type: string;
        payload: { habitId: string; title: string };
      }[];
    };
    expect(env.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.events).toHaveLength(1);
    expect(env.events[0].type).toBe("HabitCreated");
    expect(env.events[0].payload.habitId).toBe(externalId);
    expect(env.events[0].payload.title).toBe("Shape");
  });
});

describe("dispatcher gating on device registration", () => {
  it("returns offline without calling post when no accountId is set", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    // Clear the identity row that testDb seeds by default — simulate a
    // device that hasn't yet completed POST /devices/register.
    await db.delete(schema.identity);

    const post = vi.fn();
    const status = await createDispatcher({ db, post }).run();

    expect(status).toBe("offline");
    expect(post).not.toHaveBeenCalled();
  });

  it("returns offline when an identity row exists but accountId is unset", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    await db.delete(schema.identity);
    await db
      .insert(schema.identity)
      .values({ id: 1, deviceId: "d-with-no-account" });

    const post = vi.fn();
    const status = await createDispatcher({ db, post }).run();

    expect(status).toBe("offline");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("outbox sent-row retention", () => {
  it("keeps only the most recent SENT_OUTBOX_RETAIN_DEFAULT sent rows after markSent", async () => {
    const db = getDb();
    // Seed many more rows than the retention limit so prune actually fires.
    const total = SENT_OUTBOX_RETAIN_DEFAULT + 5;
    for (let i = 0; i < total; i++) {
      await processCommand(db, { type: "CreateHabit", title: `H${i}` });
    }

    let seq = 0;
    const post = vi.fn(
      async (): Promise<PostResult> => ({ ok: true, sequence: ++seq }),
    );

    expect(await createDispatcher({ db, post }).run()).toBe("idle");

    expect(await countPending(db)).toBe(0);
    expect(await countSent(db)).toBe(SENT_OUTBOX_RETAIN_DEFAULT);

    // The retained rows are the newest by id — the oldest are pruned.
    // Assert via `serverSequence` (deterministic per test, unlike SQLite's
    // autoincrement which is shared across the test file).
    const rows = await db
      .select({ serverSequence: schema.outbox.serverSequence })
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
    expect(rows.length).toBe(SENT_OUTBOX_RETAIN_DEFAULT);
    expect(rows[0].serverSequence).toBe(total - SENT_OUTBOX_RETAIN_DEFAULT + 1);
    expect(rows.at(-1)!.serverSequence).toBe(total);
  });

  it("keeps all rows when count is below the retention limit", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    let seq = 0;
    const post = vi.fn(
      async (): Promise<PostResult> => ({ ok: true, sequence: ++seq }),
    );
    await createDispatcher({ db, post }).run();

    expect(await countSent(db)).toBe(3);
  });

  it("does not prune pending or failed rows", async () => {
    const db = getDb();

    // Seed a row marked as failed (simulate a previously-halted send) and
    // a row pending to be sent now.
    await db.insert(schema.outbox).values({
      events: JSON.stringify([
        {
          type: "HabitCreated",
          payload: { habitId: "x", title: "Failed" },
        },
      ]),
      status: "failed",
      lastError: "old failure",
    });
    await processCommand(db, { type: "CreateHabit", title: "Pending" });

    // Bypass the dispatcher and call markSent directly with a tiny retention
    // window to force a prune that *would* delete other-status rows if the
    // prune query mis-targeted.
    const [pendingRow] = await db
      .select({ id: schema.outbox.id })
      .from(schema.outbox)
      .where(eq(schema.outbox.status, "pending"));
    await markSent(db, pendingRow.id, 1, /* retain */ 1);

    expect(await countFailed(db)).toBe(1);
    expect(await countSent(db)).toBe(1);
    expect(await countPending(db)).toBe(0);
  });

  it("retains every sent row when retainSentRows is negative (prune disabled)", async () => {
    const db = getDb();
    const total = 15;
    for (let i = 0; i < total; i++) {
      await processCommand(db, { type: "CreateHabit", title: `H${i}` });
    }

    const rows = await db
      .select({ id: schema.outbox.id })
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));

    let seq = 0;
    for (const r of rows) {
      await markSent(db, r.id, ++seq, /* retain */ -1);
    }

    expect(await countSent(db)).toBe(total);
  });

  it("drops every sent row when retainSentRows is 0", async () => {
    const db = getDb();
    await seedThreeCommands(db);

    const rows = await db
      .select({ id: schema.outbox.id })
      .from(schema.outbox)
      .orderBy(asc(schema.outbox.id));
    let seq = 0;
    for (const r of rows) {
      await markSent(db, r.id, ++seq, /* retain */ 0);
    }

    expect(await countSent(db)).toBe(0);
  });
});

describe("dispatcher + previously-sent rows", () => {
  it("does not reprocess rows with status='sent' (e.g. migrated pre-sync history)", async () => {
    const db = getDb();
    // Simulate a historical row the migration marked as sent.
    await db.insert(schema.outbox).values({
      events: JSON.stringify([
        {
          type: "HabitCreated",
          payload: {
            habitId: "00000000-0000-0000-0000-000000000000",
            title: "Legacy",
          },
        },
      ]),
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
