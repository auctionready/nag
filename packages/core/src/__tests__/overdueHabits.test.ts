import { describe, expect, it } from "vitest";
import * as schema from "@nag/schema";
import { overdueHabitsCount } from "../overdueHabits";
import { Day } from "../days";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("overdue-habits-test.db");

const seedDailyHabit = async (
  title: string,
  hour: number,
  minute: number,
  reminder = true,
) => {
  const db = getDb();
  const [h] = await db
    .insert(schema.habit)
    .values({ id: crypto.randomUUID(), title })
    .returning();
  const [g] = await db
    .insert(schema.goal)
    .values({ habitId: h.id, regularity: "day", frequency: 1 })
    .returning();
  await db
    .insert(schema.schedule)
    .values({ goalId: g.id, hour, minute, reminder });
  return h.id;
};

const seedWeeklyHabit = async (
  title: string,
  hour: number,
  minute: number,
  days: number,
) => {
  const db = getDb();
  const [h] = await db
    .insert(schema.habit)
    .values({ id: crypto.randomUUID(), title })
    .returning();
  const [g] = await db
    .insert(schema.goal)
    .values({ habitId: h.id, regularity: "week", frequency: 1 })
    .returning();
  await db.insert(schema.schedule).values({ goalId: g.id, hour, minute, days });
  return h.id;
};

const addSchedule = async (habitId: string, hour: number, minute: number) => {
  const db = getDb();
  const goals = await db.select().from(schema.goal);
  const goalRow = goals.find((g) => g.habitId === habitId);
  if (!goalRow) throw new Error(`no goal for habit ${habitId}`);
  await db
    .insert(schema.schedule)
    .values({ goalId: goalRow.id, hour, minute, reminder: true });
};

const insertCheckIn = async (
  habitId: string,
  timestamp: Date,
  skipped = false,
) => {
  const db = getDb();
  await db
    .insert(schema.checkIn)
    .values({ id: crypto.randomUUID(), habitId, timestamp, skipped });
};

describe("overdueHabitsCount", () => {
  // 2026-04-15 is a Wednesday.
  const morning = new Date(2026, 3, 15, 6, 0);
  const midday = new Date(2026, 3, 15, 10, 0);
  const evening = new Date(2026, 3, 15, 20, 0);

  describe("empty database", () => {
    it("returns 0", async () => {
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(0);
    });
  });

  describe("habit without a schedule", () => {
    it("does not contribute", async () => {
      const db = getDb();
      const [h] = await db
        .insert(schema.habit)
        .values({ id: crypto.randomUUID(), title: "Stretch" })
        .returning();
      await db
        .insert(schema.goal)
        .values({ habitId: h.id, regularity: "day", frequency: 1 });
      expect(await overdueHabitsCount(getDb(), { now: evening })).toBe(0);
    });
  });

  describe("single daily timed habit", () => {
    it("counts as 1 when the time has passed and no check-in exists", async () => {
      await seedDailyHabit("Read", 8, 0);
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });

    it("counts as 0 when the time is still upcoming", async () => {
      await seedDailyHabit("Read", 8, 0);
      expect(await overdueHabitsCount(getDb(), { now: morning })).toBe(0);
    });

    it("counts as 0 when a matching check-in exists", async () => {
      const habitId = await seedDailyHabit("Read", 8, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 15, 8, 0));
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(0);
    });

    it("counts as 0 when the slot was explicitly skipped", async () => {
      const habitId = await seedDailyHabit("Read", 8, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 15, 8, 0), true);
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(0);
    });
  });

  describe("multiple timed schedules on one habit", () => {
    it("counts the habit once regardless of how many slots were missed", async () => {
      const habitId = await seedDailyHabit("Pills", 8, 0);
      await addSchedule(habitId, 12, 0);
      await addSchedule(habitId, 16, 0);
      expect(await overdueHabitsCount(getDb(), { now: evening })).toBe(1);
    });

    it("still counts when only one of several slots was missed", async () => {
      const habitId = await seedDailyHabit("Pills", 8, 0);
      await addSchedule(habitId, 12, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 15, 12, 0));
      // 8am is missed; 12pm is matched.
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });

    it("does not count when every elapsed slot has a check-in", async () => {
      const habitId = await seedDailyHabit("Pills", 8, 0);
      await addSchedule(habitId, 12, 0);
      await addSchedule(habitId, 18, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 15, 8, 0));
      await insertCheckIn(habitId, new Date(2026, 3, 15, 12, 0));
      // 6pm slot is still upcoming at midday → not overdue.
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(0);
    });
  });

  describe("weekly schedules", () => {
    it("does not count a habit not scheduled today", async () => {
      // 2026-04-15 is a Wednesday — schedule only for Tuesdays.
      await seedWeeklyHabit("Yoga", 8, 0, Day.Tue);
      expect(await overdueHabitsCount(getDb(), { now: evening })).toBe(0);
    });

    it("counts a habit scheduled for today whose slot has passed", async () => {
      // Wednesday schedule, slot at 8am, now at 10am.
      await seedWeeklyHabit("Yoga", 8, 0, Day.Wed);
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });
  });

  describe("reminder flag", () => {
    it("counts even when schedule.reminder = false", async () => {
      await seedDailyHabit("Read", 8, 0, false);
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });
  });

  describe("multiple habits", () => {
    it("counts each habit independently", async () => {
      await seedDailyHabit("Read", 8, 0);
      const writeId = await seedDailyHabit("Write", 9, 0);
      await seedDailyHabit("Walk", 22, 0);
      await insertCheckIn(writeId, new Date(2026, 3, 15, 9, 0));
      // Read missed, Write done, Walk still upcoming.
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });
  });

  describe("yesterday's check-in", () => {
    it("does not satisfy today's slot", async () => {
      const habitId = await seedDailyHabit("Read", 8, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 14, 8, 0));
      expect(await overdueHabitsCount(getDb(), { now: midday })).toBe(1);
    });
  });
});
