import { describe, expect, it } from "vitest";
import { boardProgress, type BoardProgressHabit } from "../boardProgress";
import { Day } from "../days";
import type { ScheduleInfo } from "../trafficLight";

// Wednesday 2025-06-04, 13:00 local. The 4th of the month, weekday Wed.
const WED_4TH_1300 = new Date(2025, 5, 4, 13, 0);

const slot = (
  partial: Partial<ScheduleInfo> & { hour: number },
): ScheduleInfo => ({
  days: 0,
  dayOfMonth: null,
  minute: 0,
  ...partial,
});

const habit = (
  partial: Partial<BoardProgressHabit> & {
    goal: BoardProgressHabit["goal"];
  },
): BoardProgressHabit => ({
  schedules: [],
  doneToday: 0,
  skippedToday: 0,
  ...partial,
});

const daily = (frequency: number) => ({
  frequency,
  regularity: "day" as const,
});
const weekly = (frequency: number) => ({
  frequency,
  regularity: "week" as const,
});

interface Scenario {
  name: string;
  habits: BoardProgressHabit[];
  now?: Date;
  expected: number;
  done: number;
  percent: number;
  extras?: number;
  nothingDueYet?: boolean;
  hasFutureToday?: boolean;
}

const scenarios: Scenario[] = [
  // ── No goal / empty ──────────────────────────────────────────────────────
  {
    name: "empty board → all zeros",
    habits: [],
    expected: 0,
    done: 0,
    percent: 0,
  },
  {
    name: "habit with no goal never contributes",
    habits: [habit({ goal: null, doneToday: 5 })],
    expected: 0,
    done: 0,
    percent: 0,
    extras: 0,
  },

  // ── Daily, no schedule (full frequency due all day) ──────────────────────
  {
    name: "daily x3, no schedule, 1 done → 1/3",
    habits: [habit({ goal: daily(3), doneToday: 1 })],
    expected: 3,
    done: 1,
    percent: 33,
  },
  {
    name: "daily x2, no schedule, over-done caps at expected",
    habits: [habit({ goal: daily(2), doneToday: 5 })],
    expected: 2,
    done: 2,
    percent: 100,
    extras: 3,
  },

  // ── Weekly / monthly with no schedule (not a today thing) ────────────────
  {
    name: "weekly x3, no schedule → contributes 0, nothing due yet",
    habits: [habit({ goal: weekly(3), doneToday: 1 })],
    expected: 0,
    done: 0,
    percent: 0,
    extras: 1,
    nothingDueYet: true,
  },

  // ── Daily timed schedules (elapsed-by-now ramp) ──────────────────────────
  {
    name: "daily 9/12/21, at 13:00 → 2 elapsed, 1 done → 1/2",
    habits: [
      habit({
        goal: daily(3),
        schedules: [slot({ hour: 9 }), slot({ hour: 12 }), slot({ hour: 21 })],
        doneToday: 1,
      }),
    ],
    expected: 2,
    done: 1,
    percent: 50,
    hasFutureToday: true,
  },
  {
    name: "daily slot exactly at now counts",
    now: new Date(2025, 5, 4, 12, 0),
    habits: [habit({ goal: daily(1), schedules: [slot({ hour: 12 })] })],
    expected: 1,
    done: 0,
    percent: 0,
  },
  {
    name: "daily, only a future slot → nothing due yet",
    habits: [habit({ goal: daily(1), schedules: [slot({ hour: 21 })] })],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDueYet: true,
    hasFutureToday: true,
  },

  // ── Weekday-pinned schedules honour the day-of-week ──────────────────────
  {
    name: "weekend-only schedule on a Wednesday → not due",
    habits: [
      habit({
        goal: daily(2),
        schedules: [
          slot({ days: Day.Sat | Day.Sun, hour: 8 }),
          slot({ days: Day.Sat | Day.Sun, hour: 14 }),
        ],
      }),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDueYet: true,
  },
  {
    name: "weekly pinned to Wed at 9am → due on a Wednesday",
    habits: [
      habit({
        goal: weekly(1),
        schedules: [slot({ days: Day.Wed, hour: 9 })],
        doneToday: 1,
      }),
    ],
    expected: 1,
    done: 1,
    percent: 100,
  },
  {
    name: "weekly pinned to Mon at 9am → NOT due on a Wednesday (regression)",
    habits: [
      habit({
        goal: weekly(1),
        schedules: [slot({ days: Day.Mon, hour: 9 })],
      }),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDueYet: true,
  },

  // ── Floating weekly with a time (unsupported) → never due ────────────────
  {
    name: "floating weekly with a 9am reminder is not due every day (regression)",
    habits: [
      habit({
        goal: weekly(3),
        schedules: [slot({ hour: 9 })],
      }),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDueYet: true,
  },

  // ── Skips remove a slot from the denominator ─────────────────────────────
  {
    name: "skip removes a due slot: 2 due, 1 skipped → 0/1",
    habits: [
      habit({
        goal: daily(2),
        schedules: [slot({ hour: 8 }), slot({ hour: 9 })],
        skippedToday: 1,
      }),
    ],
    expected: 1,
    done: 0,
    percent: 0,
  },
  {
    name: "done + skip clears everything due → 100%",
    habits: [
      habit({
        goal: daily(2),
        schedules: [slot({ hour: 8 }), slot({ hour: 9 })],
        doneToday: 1,
        skippedToday: 1,
      }),
    ],
    expected: 1,
    done: 1,
    percent: 100,
  },
  {
    name: "everything due is skipped → habit drops out, nothing due yet",
    habits: [
      habit({
        goal: daily(2),
        schedules: [slot({ hour: 8 }), slot({ hour: 9 })],
        skippedToday: 2,
      }),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDueYet: true,
  },
  {
    name: "no-schedule daily skipped down: x3, 1 done 1 skip → 1/2",
    habits: [habit({ goal: daily(3), doneToday: 1, skippedToday: 1 })],
    expected: 2,
    done: 1,
    percent: 50,
  },

  // ── Aggregation across habits ────────────────────────────────────────────
  {
    name: "per-habit cap stops an over-done habit masking an under-done one",
    habits: [
      habit({ goal: daily(1), schedules: [slot({ hour: 9 })], doneToday: 5 }),
      habit({ goal: daily(1), schedules: [slot({ hour: 9 })], doneToday: 0 }),
    ],
    expected: 2,
    done: 1,
    percent: 50,
    extras: 4,
  },
  {
    name: "mixed board: daily due, weekly off-day, weekly today",
    habits: [
      habit({ goal: daily(2), schedules: [slot({ hour: 9 })], doneToday: 1 }),
      habit({ goal: weekly(1), schedules: [slot({ days: Day.Mon, hour: 9 })] }),
      habit({
        goal: weekly(1),
        schedules: [slot({ days: Day.Wed, hour: 9 })],
        doneToday: 1,
      }),
    ],
    expected: 2,
    done: 2,
    percent: 100,
  },
];

describe("boardProgress", () => {
  for (const s of scenarios) {
    it(s.name, () => {
      const r = boardProgress(s.habits, s.now ?? WED_4TH_1300);
      expect(r.expected).toBe(s.expected);
      expect(r.done).toBe(s.done);
      expect(r.percent).toBe(s.percent);
      if (s.extras !== undefined) expect(r.extras).toBe(s.extras);
      if (s.nothingDueYet !== undefined)
        expect(r.nothingDueYet).toBe(s.nothingDueYet);
      if (s.hasFutureToday !== undefined)
        expect(r.hasFutureToday).toBe(s.hasFutureToday);
    });
  }

  it("nothingDueYet is false on an empty board", () => {
    expect(boardProgress([], WED_4TH_1300).nothingDueYet).toBe(false);
  });
});
