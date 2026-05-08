import { describe, expect, it } from "vitest";
import { boardProgress, type BoardProgressHabit } from "../boardProgress";
import { Day } from "../days";
import type { ScheduleInfo } from "../trafficLight";

// Wednesday 2025-06-04, 13:00 local
const WED_1300 = new Date(2025, 5, 4, 13, 0);

const timed = (days: number, hour: number, minute = 0): ScheduleInfo => ({
  days,
  dayOfMonth: null,
  hour,
  minute,
});

const dailyGoal = (frequency: number) => ({
  frequency,
  regularity: "day" as const,
});
const weeklyGoal = (frequency: number) => ({
  frequency,
  regularity: "week" as const,
});

describe("boardProgress", () => {
  it("returns zeros for an empty board", () => {
    const r = boardProgress([], WED_1300);
    expect(r).toEqual({
      expected: 0,
      done: 0,
      extras: 0,
      percent: 0,
      contributingHabits: 0,
      nothingDueYet: false,
    });
  });

  describe("habit with no goal", () => {
    it("does not contribute", () => {
      const r = boardProgress(
        [{ goal: null, schedules: [], doneToday: 5 }],
        WED_1300,
      );
      expect(r).toEqual({
        expected: 0,
        done: 0,
        extras: 0,
        percent: 0,
        contributingHabits: 0,
        nothingDueYet: false,
      });
    });
  });

  describe("daily goal without schedules", () => {
    it("expects the full frequency for the whole day", () => {
      const habit: BoardProgressHabit = {
        goal: dailyGoal(3),
        schedules: [],
        doneToday: 1,
      };
      const r = boardProgress([habit], WED_1300);
      expect(r.expected).toBe(3);
      expect(r.done).toBe(1);
      expect(r.percent).toBe(33);
    });

    it("caps done at expected", () => {
      const r = boardProgress(
        [{ goal: dailyGoal(2), schedules: [], doneToday: 5 }],
        WED_1300,
      );
      expect(r.done).toBe(2);
      expect(r.extras).toBe(3);
      expect(r.percent).toBe(100);
    });
  });

  describe("weekly/monthly goal without schedules", () => {
    it("does not contribute to today's totals", () => {
      const r = boardProgress(
        [{ goal: weeklyGoal(3), schedules: [], doneToday: 1 }],
        WED_1300,
      );
      expect(r.expected).toBe(0);
      expect(r.done).toBe(0);
      expect(r.extras).toBe(1);
      expect(r.nothingDueYet).toBe(true);
    });
  });

  describe("habit with timed schedules", () => {
    it("expects only slots whose time has elapsed", () => {
      // 9am, 12pm, 9pm — at 1pm only 9am+12pm have elapsed
      const habit: BoardProgressHabit = {
        goal: dailyGoal(3),
        schedules: [timed(0, 9), timed(0, 12), timed(0, 21)],
        doneToday: 0,
      };
      const r = boardProgress([habit], WED_1300);
      expect(r.expected).toBe(2);
      expect(r.done).toBe(0);
      expect(r.percent).toBe(0);
    });

    it("ignores slots not scheduled for today", () => {
      // weekend-only schedule on a Wednesday
      const r = boardProgress(
        [
          {
            goal: dailyGoal(2),
            schedules: [
              timed(Day.Sat | Day.Sun, 8),
              timed(Day.Sat | Day.Sun, 14),
            ],
            doneToday: 0,
          },
        ],
        WED_1300,
      );
      expect(r.expected).toBe(0);
      expect(r.nothingDueYet).toBe(true);
    });

    it("treats days=0 as every day", () => {
      const r = boardProgress(
        [{ goal: dailyGoal(1), schedules: [timed(0, 9)], doneToday: 1 }],
        WED_1300,
      );
      expect(r.expected).toBe(1);
      expect(r.done).toBe(1);
      expect(r.percent).toBe(100);
    });

    it("counts a slot whose time exactly matches now", () => {
      const noon = new Date(2025, 5, 4, 12, 0);
      const r = boardProgress(
        [{ goal: dailyGoal(1), schedules: [timed(0, 12)], doneToday: 0 }],
        noon,
      );
      expect(r.expected).toBe(1);
    });
  });

  describe("aggregation across habits", () => {
    it("per-habit cap prevents over-done masking under-done", () => {
      // Habit A: did 5, expected 1 → credited 1, extras 4
      // Habit B: did 0, expected 1 → credited 0
      // Total: 1 of 2 done = 50%, NOT (5/2 = 250%)
      const habits: BoardProgressHabit[] = [
        { goal: dailyGoal(1), schedules: [timed(0, 9)], doneToday: 5 },
        { goal: dailyGoal(1), schedules: [timed(0, 9)], doneToday: 0 },
      ];
      const r = boardProgress(habits, WED_1300);
      expect(r.expected).toBe(2);
      expect(r.done).toBe(1);
      expect(r.extras).toBe(4);
      expect(r.percent).toBe(50);
    });

    it("matches the user's worked example: 3-a-day at 9/12/21, now 13", () => {
      // One habit, three slots, two elapsed, user did one
      const r = boardProgress(
        [
          {
            goal: dailyGoal(3),
            schedules: [timed(0, 9), timed(0, 12), timed(0, 21)],
            doneToday: 1,
          },
        ],
        WED_1300,
      );
      expect(r.expected).toBe(2);
      expect(r.done).toBe(1);
      expect(r.percent).toBe(50);
    });
  });

  describe("nothingDueYet", () => {
    it("true when habits have goals but expected is zero", () => {
      const r = boardProgress(
        [{ goal: dailyGoal(1), schedules: [timed(0, 21)], doneToday: 0 }],
        WED_1300,
      );
      expect(r.expected).toBe(0);
      expect(r.nothingDueYet).toBe(true);
    });

    it("false on an empty board", () => {
      expect(boardProgress([], WED_1300).nothingDueYet).toBe(false);
    });

    it("false when expected > 0", () => {
      const r = boardProgress(
        [{ goal: dailyGoal(1), schedules: [timed(0, 9)], doneToday: 0 }],
        WED_1300,
      );
      expect(r.nothingDueYet).toBe(false);
    });
  });
});
