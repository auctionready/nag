import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@nag/schema";
import type { AnyDb } from "../db";
import { processCommand } from "../commands/processor";
import {
  boardHabits,
  archivedHabits,
  allActiveSchedules,
  allSchedules,
} from "../queries";
import { setupTestDb } from "./testDb";
import { AllDays } from "../days";

const getDb = setupTestDb("archive-pause-test.db");

const createHabit = async (
  db: AnyDb,
  title: string,
  scheduled = false,
): Promise<string> => {
  const habitId = crypto.randomUUID();
  await processCommand(db, {
    type: "CreateHabit",
    habitId,
    title,
    ...(scheduled
      ? {
          goal: {
            regularity: "week" as const,
            schedules: [{ hour: 9, minute: 0, days: AllDays }],
          },
        }
      : {}),
  });
  return habitId;
};

const flags = async (db: AnyDb, habitId: string) => {
  const [h] = await db
    .select({
      archivedAt: schema.habit.archivedAt,
      pausedAt: schema.habit.pausedAt,
    })
    .from(schema.habit)
    .where(eq(schema.habit.id, habitId));
  return h;
};

/** Count outbox-enqueued events of a given type (emitted by handlers). */
const outboxEventCount = async (db: AnyDb, type: string): Promise<number> => {
  const rows = await db.select().from(schema.outbox);
  return rows
    .flatMap((r) => JSON.parse(r.events) as { type: string }[])
    .filter((e) => e.type === type).length;
};

describe("ArchiveHabit / UnarchiveHabit", () => {
  it("archive sets archivedAt", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "ArchiveHabit", habitId });
    expect((await flags(db, habitId)).archivedAt).toBeInstanceOf(Date);
  });

  it("unarchive clears both archivedAt and pausedAt", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    // Pause then archive — both flags set.
    await processCommand(db, { type: "PauseHabit", habitId });
    await processCommand(db, { type: "ArchiveHabit", habitId });
    let f = await flags(db, habitId);
    expect(f.archivedAt).toBeInstanceOf(Date);
    expect(f.pausedAt).toBeInstanceOf(Date);

    await processCommand(db, { type: "UnarchiveHabit", habitId });
    f = await flags(db, habitId);
    expect(f.archivedAt).toBeNull();
    expect(f.pausedAt).toBeNull();
  });
});

describe("PauseHabit / UnpauseHabit", () => {
  it("pause sets pausedAt and unpause clears it", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "PauseHabit", habitId });
    expect((await flags(db, habitId)).pausedAt).toBeInstanceOf(Date);
    await processCommand(db, { type: "UnpauseHabit", habitId });
    expect((await flags(db, habitId)).pausedAt).toBeNull();
  });
});

// The command handlers check current state and emit no event for an
// invalid/redundant transition (idempotent, never erroring).
describe("transition guards (handlers emit no event when invalid)", () => {
  it("does not re-emit when archiving an already-archived habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "ArchiveHabit", habitId });
    await processCommand(db, { type: "ArchiveHabit", habitId });
    expect(await outboxEventCount(db, "HabitArchived")).toBe(1);
  });

  it("does not emit when unarchiving a non-archived habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "UnarchiveHabit", habitId });
    expect(await outboxEventCount(db, "HabitUnarchived")).toBe(0);
  });

  it("does not emit when pausing an archived habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "ArchiveHabit", habitId });
    await processCommand(db, { type: "PauseHabit", habitId });
    expect(await outboxEventCount(db, "HabitPaused")).toBe(0);
    expect((await flags(db, habitId)).pausedAt).toBeNull();
  });

  it("does not emit when pausing an already-paused habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "PauseHabit", habitId });
    await processCommand(db, { type: "PauseHabit", habitId });
    expect(await outboxEventCount(db, "HabitPaused")).toBe(1);
  });

  it("does not emit when unpausing a non-paused habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "UnpauseHabit", habitId });
    expect(await outboxEventCount(db, "HabitUnpaused")).toBe(0);
  });
});

const checkIn = (db: AnyDb, habitId: string, timestamp: Date) =>
  processCommand(db, {
    type: "CreateCheckIn",
    checkInId: crypto.randomUUID(),
    habitId,
    timestamp,
  });

describe("check-in lifecycle rules", () => {
  it("rejects a check-in for an archived habit", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "ArchiveHabit", habitId });
    await expect(checkIn(db, habitId, new Date())).rejects.toThrow();
  });

  it("rejects a check-in after the pause time", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "PauseHabit", habitId });
    await expect(
      checkIn(db, habitId, new Date(Date.now() + 1000)),
    ).rejects.toThrow();
  });

  it("allows backfilling a check-in before the pause time", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "PauseHabit", habitId });
    await checkIn(db, habitId, new Date(Date.now() - 60_000));
    const rows = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(rows).toHaveLength(1);
  });

  it("allows a check-in at exactly the pause time (picker cap boundary)", async () => {
    const db = getDb();
    const habitId = await createHabit(db, "Read");
    await processCommand(db, { type: "PauseHabit", habitId });
    const pausedAt = (await flags(db, habitId)).pausedAt as Date;
    await checkIn(db, habitId, pausedAt);
    const rows = await db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.habitId, habitId));
    expect(rows).toHaveLength(1);
  });
});

describe("query filtering", () => {
  it("boardHabits excludes archived but keeps paused", async () => {
    const db = getDb();
    const active = await createHabit(db, "Active");
    const paused = await createHabit(db, "Paused");
    const archived = await createHabit(db, "Archived");
    await processCommand(db, { type: "PauseHabit", habitId: paused });
    await processCommand(db, { type: "ArchiveHabit", habitId: archived });

    const board = await boardHabits(db);
    const ids = board.map((h) => h.id);
    expect(ids).toContain(active);
    expect(ids).toContain(paused);
    expect(ids).not.toContain(archived);
  });

  it("archivedHabits returns only archived", async () => {
    const db = getDb();
    const active = await createHabit(db, "Active");
    const archived = await createHabit(db, "Archived");
    await processCommand(db, { type: "ArchiveHabit", habitId: archived });

    const list = await archivedHabits(db);
    const ids = list.map((h) => h.id);
    expect(ids).toEqual([archived]);
    expect(ids).not.toContain(active);
  });

  it("paused and archived habits drop out of the schedule", async () => {
    const db = getDb();
    const active = await createHabit(db, "Active", true);
    const paused = await createHabit(db, "Paused", true);
    const archived = await createHabit(db, "Archived", true);
    await processCommand(db, { type: "PauseHabit", habitId: paused });
    await processCommand(db, { type: "ArchiveHabit", habitId: archived });

    for (const rows of [await allActiveSchedules(db), await allSchedules(db)]) {
      const ids = rows.map((r) => r.habitId);
      expect(ids).toContain(active);
      expect(ids).not.toContain(paused);
      expect(ids).not.toContain(archived);
    }
  });
});
