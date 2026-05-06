import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import { createPullSync, type GetSyncFn, type SyncResult } from "../pullSync";

const getDb = setupTestDb("pull-sync-test.db");

const habitId = "11111111-1111-4111-8111-111111111111";

const okSync = (response: SyncResult) =>
  vi.fn<GetSyncFn>().mockResolvedValue({ ok: true, response });

describe("createPullSync", () => {
  it("returns idle when server reports replay with empty events", async () => {
    const db = getDb();
    const getSync = okSync({
      mode: "replay",
      events: [],
      headSequence: 0,
      nextSince: null,
    });

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("idle");
    expect(getSync).toHaveBeenCalledWith(0);
  });

  it("treats omitted events array as empty", async () => {
    const db = getDb();
    // Server omits null fields under JsonIgnoreCondition.WhenWritingNull,
    // so `events` may arrive as undefined when empty.
    const getSync = okSync({ mode: "replay", headSequence: 0 });

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("idle");
  });

  it("applies replay events in order, advancing the high-water mark", async () => {
    const db = getDb();
    const getSync = okSync({
      mode: "replay",
      events: [
        {
          sequence: 1,
          type: "HabitCreated",
          payload: { habitId, title: "Read", goal: null },
        },
        {
          sequence: 2,
          type: "HabitDetailsEdited",
          payload: { habitId, title: "Read more" },
        },
      ],
      headSequence: 2,
      nextSince: null,
    });

    await createPullSync({ db, getSync }).run();

    const [h] = await db.select().from(schema.habit);
    expect(h.title).toBe("Read more");

    const [s] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.value).toBe(2);
  });

  it("installs a snapshot when server returns mode=snapshot", async () => {
    const db = getDb();
    const getSync = okSync({
      mode: "snapshot",
      sequenceAtSnapshot: 99,
      snapshot: {
        habits: [
          {
            id: habitId,
            title: "Snapshot habit",
            description: null,
            icon: null,
            goal: null,
            schedules: null,
            periodCheckIns: null,
          },
        ],
      },
    });

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("idle");

    const [h] = await db.select().from(schema.habit);
    expect(h.title).toBe("Snapshot habit");

    const [s] = await db
      .select({ value: schema.syncState.highestServerSequence })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.value).toBe(99);
  });

  it("pages: follows nextSince across multiple replay calls (and stops on omitted nextSince)", async () => {
    const db = getDb();
    const getSync = vi
      .fn<GetSyncFn>()
      .mockResolvedValueOnce({
        ok: true,
        response: {
          mode: "replay",
          events: [
            {
              sequence: 1,
              type: "HabitCreated",
              payload: { habitId, title: "First", goal: null },
            },
          ],
          headSequence: 5,
          nextSince: 1,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        response: {
          mode: "replay",
          events: [
            {
              sequence: 2,
              type: "HabitDetailsEdited",
              payload: { habitId, title: "Second" },
            },
          ],
          headSequence: 5,
          // nextSince intentionally omitted — last page; server drops
          // null fields under WhenWritingNull.
        },
      });

    await createPullSync({ db, getSync }).run();

    expect(getSync).toHaveBeenCalledTimes(2);
    expect(getSync).toHaveBeenNthCalledWith(1, 0);
    expect(getSync).toHaveBeenNthCalledWith(2, 1);

    const [h] = await db.select().from(schema.habit);
    expect(h.title).toBe("Second");
  });

  it("respects maxPages cap", async () => {
    const db = getDb();
    let seq = 0;
    const getSync = vi.fn<GetSyncFn>(async (since) => ({
      ok: true,
      response: {
        mode: "replay",
        events: [
          {
            sequence: ++seq,
            type: "HabitCreated",
            payload: {
              habitId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
              title: `H${seq}`,
              goal: null,
            },
          },
        ],
        headSequence: 1000,
        nextSince: since + 1,
      },
    }));

    await createPullSync({ db, getSync, maxPages: 3 }).run();
    expect(getSync).toHaveBeenCalledTimes(3);
  });

  it("returns offline without calling getSync when accountId is null (anonymous mode)", async () => {
    const db = getDb();
    // Simulate anonymous-as-local: identity row exists with a deviceId
    // but no accountId yet (or after sign-out's clearLocalAuth).
    await db
      .update(schema.identity)
      .set({ accountId: null, registeredAt: null })
      .where(eq(schema.identity.id, 1));
    const getSync = vi
      .fn<GetSyncFn>()
      .mockRejectedValue(new Error("must not be called"));

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("offline");
    expect(getSync).not.toHaveBeenCalled();
  });

  it("returns offline on transient failure without applying anything", async () => {
    const db = getDb();
    const getSync = vi.fn<GetSyncFn>().mockResolvedValue({
      ok: false,
      kind: "transient",
      message: "ECONNREFUSED",
    });

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("offline");
    expect(await db.select().from(schema.habit)).toHaveLength(0);
  });

  it("returns offline (not halted) on non-retriable failure", async () => {
    const db = getDb();
    const getSync = vi.fn<GetSyncFn>().mockResolvedValue({
      ok: false,
      kind: "non-retriable",
      status: 401,
      message: "auth",
    });

    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("offline");
    expect(await schema.syncState.halted).toBeDefined();
    const [s] = await db
      .select({ halted: schema.syncState.halted })
      .from(schema.syncState)
      .where(eq(schema.syncState.id, 1));
    expect(s.halted).toBe(false);
  });

  it("skips the call when halted", async () => {
    const db = getDb();
    await db
      .update(schema.syncState)
      .set({ halted: true })
      .where(eq(schema.syncState.id, 1));

    const getSync = vi.fn<GetSyncFn>();
    const status = await createPullSync({ db, getSync }).run();
    expect(status).toBe("halted");
    expect(getSync).not.toHaveBeenCalled();
  });

  it("uses the current high-water mark on first call", async () => {
    const db = getDb();
    await db
      .update(schema.syncState)
      .set({ highestServerSequence: 50 })
      .where(eq(schema.syncState.id, 1));

    const getSync = okSync({
      mode: "replay",
      events: [],
      headSequence: 50,
      nextSince: null,
    });

    await createPullSync({ db, getSync }).run();
    expect(getSync).toHaveBeenCalledWith(50);
  });

  describe("old check-in pruning", () => {
    /**
     * Seed a habit + one stale check-in (older than the previous-month
     * cutoff) and one fresh one. The outbox is left empty so
     * `pruneOldCheckInsIfSafe`'s drained-outbox gate is satisfied — that
     * gate is exercised by `retention.test.ts`; here we only care that
     * pullSync invokes (or skips) the helper based on the option.
     */
    const seedStaleAndFreshCheckIns = async (db: ReturnType<typeof getDb>) => {
      const [h] = await db
        .insert(schema.habit)
        .values({ title: "Read" })
        .returning({ id: schema.habit.id });
      await db
        .insert(schema.checkIn)
        .values({ habitId: h.id, timestamp: new Date("2000-01-01T00:00:00Z") });
      await db
        .insert(schema.checkIn)
        .values({ habitId: h.id, timestamp: new Date() });
      return h.id;
    };

    const noopSync = () =>
      okSync({ mode: "replay", events: [], headSequence: 0, nextSince: null });

    it("keeps stale check-ins when pruneOldCheckIns is false (default)", async () => {
      const db = getDb();
      await seedStaleAndFreshCheckIns(db);

      await createPullSync({
        db,
        getSync: noopSync(),
        pruneOldCheckIns: false,
      }).run();

      const rows = await db.select().from(schema.checkIn);
      expect(rows).toHaveLength(2);
    });

    it("drops stale check-ins when pruneOldCheckIns is true", async () => {
      const db = getDb();
      await seedStaleAndFreshCheckIns(db);

      await createPullSync({
        db,
        getSync: noopSync(),
        pruneOldCheckIns: true,
      }).run();

      const rows = await db.select().from(schema.checkIn);
      expect(rows).toHaveLength(1);
      // The fresh row (timestamp = "now") must be the survivor.
      expect(rows[0].timestamp.getTime()).toBeGreaterThan(
        new Date("2020-01-01").getTime(),
      );
    });
  });
});
