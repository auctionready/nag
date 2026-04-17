import { describe, it, expect, beforeEach, vi } from "vitest";
import * as schema from "@nag/schema";
import {
  setConsolidatedScheduler,
  syncAllNotifications,
  type ConsolidatedNotificationScheduler,
} from "../notificationConsolidator";
import { Day } from "../days";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("sync-test.db");

const cancelAll = vi.fn<
  ConsolidatedNotificationScheduler["cancelAllSlotNotifications"]
>(async () => {});
const scheduleOne = vi.fn<
  ConsolidatedNotificationScheduler["scheduleSlotNotification"]
>(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  setConsolidatedScheduler({
    cancelAllSlotNotifications: cancelAll,
    scheduleSlotNotification: scheduleOne,
  });
});

const seedDailyHabit = async (
  title: string,
  hour: number,
  minute: number,
  reminder = true,
) => {
  const db = getDb();
  const [h] = await db.insert(schema.habit).values({ title }).returning();
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
  reminder = true,
) => {
  const db = getDb();
  const [h] = await db.insert(schema.habit).values({ title }).returning();
  const [g] = await db
    .insert(schema.goal)
    .values({ habitId: h.id, regularity: "week", frequency: 1 })
    .returning();
  await db
    .insert(schema.schedule)
    .values({ goalId: g.id, hour, minute, days, reminder });
  return h.id;
};

const seedMonthlyHabit = async (
  title: string,
  hour: number,
  minute: number,
  dayOfMonth: number,
  reminder = true,
) => {
  const db = getDb();
  const [h] = await db.insert(schema.habit).values({ title }).returning();
  const [g] = await db
    .insert(schema.goal)
    .values({ habitId: h.id, regularity: "month", frequency: 1 })
    .returning();
  await db
    .insert(schema.schedule)
    .values({ goalId: g.id, hour, minute, dayOfMonth, reminder });
  return h.id;
};

const insertCheckIn = async (
  habitId: number,
  timestamp: Date,
  skipped = false,
) => {
  const db = getDb();
  await db.insert(schema.checkIn).values({ habitId, timestamp, skipped });
};

describe("syncAllNotifications", () => {
  describe("single daily slot", () => {
    it("schedules one occurrence per day for the horizon when no check-ins exist", async () => {
      // Wed 2026-04-15 06:00 — today's 08:00 is still in the future.
      const now = new Date(2026, 3, 15, 6, 0);
      await seedDailyHabit("Read", 8, 0);

      await syncAllNotifications(getDb(), { now });

      expect(cancelAll).toHaveBeenCalledOnce();
      expect(scheduleOne).toHaveBeenCalledTimes(7);
      const fireAts = scheduleOne.mock.calls.map((c) => c[0].fireAt);
      expect(fireAts[0]).toEqual(new Date(2026, 3, 15, 8, 0));
      expect(fireAts[6]).toEqual(new Date(2026, 3, 21, 8, 0));
    });

    it("drops today's occurrence when the habit is already checked in today", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      const habitId = await seedDailyHabit("Read", 8, 0);
      // Back-filled check-in at the slot time.
      await insertCheckIn(habitId, new Date(2026, 3, 15, 8, 0));

      await syncAllNotifications(getDb(), { now });

      expect(scheduleOne).toHaveBeenCalledTimes(6);
      const fireAts = scheduleOne.mock.calls.map((c) => c[0].fireAt);
      expect(fireAts[0]).toEqual(new Date(2026, 3, 16, 8, 0));
    });

    it("drops today when the habit has been skipped today", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      const habitId = await seedDailyHabit("Read", 8, 0);
      await insertCheckIn(habitId, new Date(2026, 3, 15, 8, 0), true);

      await syncAllNotifications(getDb(), { now });

      expect(scheduleOne).toHaveBeenCalledTimes(6);
    });

    it("does not schedule when schedule.reminder = false", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      await seedDailyHabit("Read", 8, 0, false);

      await syncAllNotifications(getDb(), { now });

      expect(scheduleOne).not.toHaveBeenCalled();
    });
  });

  describe("multi-habit daily slot", () => {
    it("trims title/body to unchecked habits but keeps full habitIds in data", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      const readId = await seedDailyHabit("Read", 8, 0);
      const stretchId = await seedDailyHabit("Stretch", 8, 0);
      await insertCheckIn(readId, new Date(2026, 3, 15, 8, 0));

      await syncAllNotifications(getDb(), { now });

      const todayCall = scheduleOne.mock.calls.find(
        (c) =>
          (c[0].fireAt as Date).getTime() ===
          new Date(2026, 3, 15, 8, 0).getTime(),
      );
      expect(todayCall).toBeDefined();
      expect(todayCall![0].title).toBe("Stretch");
      expect(todayCall![0].body).toBe("Time for Stretch");
      expect(todayCall![0].data).toMatchObject({
        habitIds: [readId, stretchId],
        slotHour: 8,
        slotMinute: 0,
      });

      const tomorrowCall = scheduleOne.mock.calls.find(
        (c) =>
          (c[0].fireAt as Date).getTime() ===
          new Date(2026, 3, 16, 8, 0).getTime(),
      );
      expect(tomorrowCall![0].title).toBe("2 habits due");
      expect(tomorrowCall![0].body).toBe("Read, Stretch");
    });

    it("drops the occurrence entirely when all habits in the slot are satisfied", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      const readId = await seedDailyHabit("Read", 8, 0);
      const stretchId = await seedDailyHabit("Stretch", 8, 0);
      await insertCheckIn(readId, new Date(2026, 3, 15, 8, 0));
      await insertCheckIn(stretchId, new Date(2026, 3, 15, 8, 0));

      await syncAllNotifications(getDb(), { now });

      const todayCall = scheduleOne.mock.calls.find(
        (c) =>
          (c[0].fireAt as Date).getTime() ===
          new Date(2026, 3, 15, 8, 0).getTime(),
      );
      expect(todayCall).toBeUndefined();
      // Tomorrow onwards still scheduled (fresh day, no check-ins).
      expect(scheduleOne.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe("weekly bitmask", () => {
    it("fans out across the target weekdays", async () => {
      // Wed 2026-04-15 10:00 — today's slots already past.
      const now = new Date(2026, 3, 15, 10, 0);
      await seedWeeklyHabit("Run", 8, 0, Day.Mon | Day.Wed);

      await syncAllNotifications(getDb(), { now });

      // 4 Mondays + 4 Wednesdays = 8 occurrences.
      expect(scheduleOne).toHaveBeenCalledTimes(8);
      const fireAts = scheduleOne.mock.calls
        .map((c) => c[0].fireAt as Date)
        .sort((a, b) => a.getTime() - b.getTime());
      expect(fireAts[0].getDay()).toBe(1); // Monday first
    });
  });

  describe("monthly", () => {
    it("skips months whose dayOfMonth doesn't exist", async () => {
      // 2026-01-31 09:00 — today's 08:00 already past.
      const now = new Date(2026, 0, 31, 9, 0);
      await seedMonthlyHabit("Review", 8, 0, 31);

      await syncAllNotifications(getDb(), { now });

      expect(scheduleOne).toHaveBeenCalledTimes(3);
      const fireAts = scheduleOne.mock.calls.map((c) => c[0].fireAt as Date);
      // Next valid 31sts: Mar, May, Jul.
      expect(fireAts[0]).toEqual(new Date(2026, 2, 31, 8, 0));
    });
  });

  describe("identifier format", () => {
    it("emits `slot-<key>-YYYYMMDD-HHmm`, unique per occurrence", async () => {
      const now = new Date(2026, 3, 15, 6, 0);
      await seedDailyHabit("Read", 8, 30);

      await syncAllNotifications(getDb(), { now });

      const ids = scheduleOne.mock.calls.map((c) => c[0].identifier);
      expect(ids[0]).toBe("slot-daily-08-30-20260415-0830");
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("cancellation", () => {
    it("is called exactly once per sync", async () => {
      await seedDailyHabit("A", 8, 0);
      await seedDailyHabit("B", 12, 0);

      await syncAllNotifications(getDb(), { now: new Date(2026, 3, 15, 6, 0) });

      expect(cancelAll).toHaveBeenCalledOnce();
    });

    it("is called even when there are no active schedules (clears any stale OS ones)", async () => {
      await syncAllNotifications(getDb(), { now: new Date(2026, 3, 15, 6, 0) });
      expect(cancelAll).toHaveBeenCalledOnce();
      expect(scheduleOne).not.toHaveBeenCalled();
    });
  });
});
