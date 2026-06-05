import { describe, it, expect } from "vitest";
import { asc } from "drizzle-orm";
import * as schema from "@nag/schema";
import type { AnyDb } from "../db";
import { processCommand } from "../commands/processor";
import { setupTestDb } from "./testDb";

/**
 * Matrix coverage for every command → events translation. The local-DB
 * outcomes are already exercised by `commands.test.ts`; this file
 * asserts the exact event sequence that lands in the outbox so the
 * server sees the right past-tense facts.
 *
 * Helper: read the most recently inserted outbox row and parse its
 * events array. Returns `[]` when no row exists (a no-op intent
 * shouldn't write a row).
 */
const getDb = setupTestDb("command-events-test.db");

type Entry = { type: string; payload: Record<string, unknown> };

const latestEnvelopeEvents = async (db: AnyDb): Promise<Entry[] | null> => {
  const rows = await db
    .select()
    .from(schema.outbox)
    .orderBy(asc(schema.outbox.id));
  if (rows.length === 0) return null;
  return JSON.parse(rows[rows.length - 1].events) as Entry[];
};

const allEnvelopes = async (db: AnyDb): Promise<Entry[][]> => {
  const rows = await db
    .select()
    .from(schema.outbox)
    .orderBy(asc(schema.outbox.id));
  return rows.map((r) => JSON.parse(r.events) as Entry[]);
};

describe("CreateHabit emits HabitCreated", () => {
  it("with no goal: goal is null", async () => {
    const db = getDb();
    const habitId = crypto.randomUUID();
    const externalId = habitId;
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitCreated",
        payload: {
          habitId: externalId,
          title: "Read",
          description: null,
          icon: null,
          goal: null,
        },
      },
    ]);
  });

  it("with a frequency goal: goal carries frequency, schedules:null", async () => {
    const db = getDb();
    const habitId = crypto.randomUUID();
    const externalId = habitId;
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Meditate",
      goal: { regularity: "day", frequency: 2 },
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toHaveLength(1);
    expect(events![0].type).toBe("HabitCreated");
    expect(events![0].payload).toEqual({
      habitId: externalId,
      title: "Meditate",
      description: null,
      icon: null,
      goal: { regularity: "day", frequency: 2, schedules: null },
    });
  });

  it("with a scheduled goal: schedules carry hour/minute/days/dayOfMonth/reminder", async () => {
    const db = getDb();
    await processCommand(db, {
      type: "CreateHabit",
      habitId: crypto.randomUUID(),
      title: "Exercise",
      goal: {
        regularity: "week",
        schedules: [{ hour: 7, minute: 0, days: 0b0101010 }],
      },
    });

    const events = await latestEnvelopeEvents(db);
    const payload = events![0].payload as { goal: { schedules: unknown[] } };
    expect(payload.goal.schedules).toEqual([
      {
        hour: 7,
        minute: 0,
        days: 0b0101010,
        dayOfMonth: null,
        reminder: null,
      },
    ]);
  });
});

describe("UpdateHabit event combinations", () => {
  const seedHabit = async (
    db: AnyDb,
    overrides?: Partial<{ description: string; goalFreq: number }>,
  ) => {
    const habitId = crypto.randomUUID();
    const externalId = habitId;
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Initial",
      ...(overrides?.description ? { description: overrides.description } : {}),
      ...(overrides?.goalFreq
        ? {
            goal: { regularity: "day" as const, frequency: overrides.goalFreq },
          }
        : {}),
    });
    return { habitId, externalId };
  };

  it("title only → [HabitDetailsEdited{title}]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "Renamed",
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitDetailsEdited",
        payload: { habitId: externalId, title: "Renamed" },
      },
    ]);
  });

  it("description set → [HabitDetailsEdited{description}]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: "Now with desc",
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitDetailsEdited",
        payload: { habitId: externalId, description: "Now with desc" },
      },
    ]);
  });

  it("description=null → [HabitDetailsEdited{clearDescription:true}]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db, {
      description: "Existing",
    });
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: null,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitDetailsEdited",
        payload: { habitId: externalId, clearDescription: true },
      },
    ]);
  });

  it("title + description → [HabitDetailsEdited{title, description}]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "T",
      description: "D",
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitDetailsEdited",
        payload: { habitId: externalId, title: "T", description: "D" },
      },
    ]);
  });

  it("goal=null only → [HabitGoalCleared]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db, { goalFreq: 1 });
    await processCommand(db, { type: "UpdateHabit", habitId, goal: null });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      { type: "HabitGoalCleared", payload: { habitId: externalId } },
    ]);
  });

  it("new goal only → [HabitGoalDefined]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      goal: { regularity: "day", frequency: 3 },
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "HabitGoalDefined",
        payload: {
          habitId: externalId,
          regularity: "day",
          frequency: 3,
          schedules: null,
        },
      },
    ]);
  });

  it("title + goal=null → [HabitDetailsEdited, HabitGoalCleared] in that order", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db, { goalFreq: 1 });
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "T",
      goal: null,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events?.map((e) => e.type)).toEqual([
      "HabitDetailsEdited",
      "HabitGoalCleared",
    ]);
    expect(events![0].payload).toEqual({ habitId: externalId, title: "T" });
    expect(events![1].payload).toEqual({ habitId: externalId });
  });

  it("title + new goal → [HabitDetailsEdited, HabitGoalDefined] in that order", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db);
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: "T",
      goal: { regularity: "week", frequency: 2 },
    });

    const events = await latestEnvelopeEvents(db);
    expect(events?.map((e) => e.type)).toEqual([
      "HabitDetailsEdited",
      "HabitGoalDefined",
    ]);
    expect(events![1].payload).toMatchObject({
      habitId: externalId,
      regularity: "week",
      frequency: 2,
    });
  });

  it("description=null + new goal → [HabitDetailsEdited{clearDescription}, HabitGoalDefined]", async () => {
    const db = getDb();
    const { habitId, externalId } = await seedHabit(db, {
      description: "Existing",
    });
    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      description: null,
      goal: { regularity: "day", frequency: 1 },
    });

    const events = await latestEnvelopeEvents(db);
    expect(events?.map((e) => e.type)).toEqual([
      "HabitDetailsEdited",
      "HabitGoalDefined",
    ]);
    expect(events![0].payload).toEqual({
      habitId: externalId,
      clearDescription: true,
    });
  });

  it("only habitId (no diff fields) → [] and no outbox row written", async () => {
    const db = getDb();
    const { habitId } = await seedHabit(db);
    // Drain the seed envelope so we can assert nothing new lands.
    await db.delete(schema.outbox);

    await processCommand(db, { type: "UpdateHabit", habitId });

    const envelopes = await allEnvelopes(db);
    expect(envelopes).toEqual([]);
  });
});

describe("DeleteHabit emits HabitDeleted", () => {
  it("with the habit's externalId", async () => {
    const db = getDb();
    const habitId = crypto.randomUUID();
    const externalId = habitId;
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Temp",
    });
    await processCommand(db, { type: "DeleteHabit", habitId });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      { type: "HabitDeleted", payload: { habitId: externalId } },
    ]);
  });
});

describe("CreateCheckIn emits CheckInRecorded", () => {
  it("with checkInId, habitId, timestamp, and skipped:false default", async () => {
    const db = getDb();
    const habitId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const checkInId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateCheckIn",
      checkInId,
      habitId,
      timestamp: ts,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "CheckInRecorded",
        payload: {
          checkInId,
          habitId,
          timestamp: ts.toISOString(),
          skipped: false,
        },
      },
    ]);
  });

  it("preserves the skipped flag when explicitly set to true", async () => {
    const db = getDb();
    const habitId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    await processCommand(db, {
      type: "CreateCheckIn",
      checkInId: crypto.randomUUID(),
      habitId,
      timestamp: new Date(),
      skipped: true,
    });

    const events = await latestEnvelopeEvents(db);
    expect((events![0].payload as { skipped: boolean }).skipped).toBe(true);
  });
});

describe("UpdateCheckIn event combinations", () => {
  const seedCheckIn = async (db: AnyDb, ts: Date, skipped = false) => {
    const habitId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "H",
    });
    const checkInId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateCheckIn",
      checkInId,
      habitId,
      timestamp: ts,
      skipped,
    });
    return { habitId, checkInId };
  };

  it("timestamp changed only → [CheckInMoved]", async () => {
    const db = getDb();
    const oldTs = new Date("2026-04-30T08:00:00.000Z");
    const newTs = new Date("2026-04-30T09:00:00.000Z");
    const { checkInId, habitId } = await seedCheckIn(db, oldTs);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: newTs,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "CheckInMoved",
        payload: {
          checkInId,
          habitId,
          oldTimestamp: oldTs.toISOString(),
          newTimestamp: newTs.toISOString(),
        },
      },
    ]);
  });

  it("skipped false→true (timestamp same) → [CheckInMarkedSkipped]", async () => {
    const db = getDb();
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const { checkInId, habitId } = await seedCheckIn(db, ts);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: ts,
      skipped: true,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "CheckInMarkedSkipped",
        payload: {
          checkInId,
          habitId,
          timestamp: ts.toISOString(),
        },
      },
    ]);
  });

  it("skipped true→false (timestamp same) → [CheckInMarkedDone]", async () => {
    const db = getDb();
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const { checkInId, habitId } = await seedCheckIn(db, ts, true);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: ts,
      skipped: false,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "CheckInMarkedDone",
        payload: {
          checkInId,
          habitId,
          timestamp: ts.toISOString(),
        },
      },
    ]);
  });

  it("timestamp changed + skipped false→true → [CheckInMoved, CheckInMarkedSkipped] in that order", async () => {
    const db = getDb();
    const oldTs = new Date("2026-04-30T08:00:00.000Z");
    const newTs = new Date("2026-04-30T09:30:00.000Z");
    const { checkInId } = await seedCheckIn(db, oldTs);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: newTs,
      skipped: true,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events?.map((e) => e.type)).toEqual([
      "CheckInMoved",
      "CheckInMarkedSkipped",
    ]);
    // The skip event carries the new timestamp (post-move).
    expect((events![1].payload as { timestamp: string }).timestamp).toBe(
      newTs.toISOString(),
    );
    expect((events![0].payload as { checkInId: string }).checkInId).toBe(
      checkInId,
    );
  });

  it("timestamp changed + skipped true→false → [CheckInMoved, CheckInMarkedDone]", async () => {
    const db = getDb();
    const oldTs = new Date("2026-04-30T08:00:00.000Z");
    const newTs = new Date("2026-04-30T09:30:00.000Z");
    const { checkInId } = await seedCheckIn(db, oldTs, true);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: newTs,
      skipped: false,
    });

    const events = await latestEnvelopeEvents(db);
    expect(events?.map((e) => e.type)).toEqual([
      "CheckInMoved",
      "CheckInMarkedDone",
    ]);
  });

  it("no diff (same timestamp, same skipped, no skipped supplied) → [] and no outbox row", async () => {
    const db = getDb();
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const { checkInId } = await seedCheckIn(db, ts);
    await db.delete(schema.outbox);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: ts,
    });

    expect(await allEnvelopes(db)).toEqual([]);
  });

  it("no diff (same timestamp, same skipped, skipped explicitly equal) → [] and no outbox row", async () => {
    const db = getDb();
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const { checkInId } = await seedCheckIn(db, ts, false);
    await db.delete(schema.outbox);

    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: ts,
      skipped: false,
    });

    expect(await allEnvelopes(db)).toEqual([]);
  });
});

describe("DeleteCheckIn emits CheckInDeleted", () => {
  it("carries the timestamp the row had at delete time", async () => {
    const db = getDb();
    const ts = new Date("2026-04-30T08:00:00.000Z");
    const habitId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateHabit",
      habitId,
      title: "H",
    });
    const checkInId = crypto.randomUUID();
    await processCommand(db, {
      type: "CreateCheckIn",
      checkInId,
      habitId,
      timestamp: ts,
    });
    await processCommand(db, { type: "DeleteCheckIn", checkInId });

    const events = await latestEnvelopeEvents(db);
    expect(events).toEqual([
      {
        type: "CheckInDeleted",
        payload: {
          checkInId,
          habitId,
          timestamp: ts.toISOString(),
        },
      },
    ]);
  });
});
