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
