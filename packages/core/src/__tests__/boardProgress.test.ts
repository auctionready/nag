import { describe, expect, it } from "vitest";
import { boardProgress, type BoardProgressHabit } from "../boardProgress";
import { AllDays, Day } from "../days";
import type { ScheduleInfo } from "../trafficLight";

// Wednesday 2025-06-04, 13:00 local. The time of day is deliberately *before*
// some of the slots below — the metric must ignore clock time entirely.
const WED_1300 = new Date(2025, 5, 4, 13, 0);

const popcount = (n: number): number => {
  let count = 0;
  for (let bits = n; bits > 0; bits >>= 1) count += bits & 1;
  return count;
};

/** A schedule time-slot; defaults to every weekday. */
const slot = (
  partial: Partial<ScheduleInfo> & { hour: number },
): ScheduleInfo => ({
  days: AllDays,
  dayOfMonth: null,
  minute: 0,
  ...partial,
});

type Tally = Partial<Pick<BoardProgressHabit, "doneToday" | "skippedToday">>;

/** A frequency habit: a daily/weekly/monthly count with no schedule rows. */
const freqHabit = (
  regularity: "day" | "week" | "month",
  frequency: number,
  tally: Tally = {},
): BoardProgressHabit => ({
  goal: { regularity, frequency },
  schedules: [],
  doneToday: 0,
  skippedToday: 0,
  ...tally,
});

/**
 * A scheduled habit — always a weekly goal carrying timed slots, exactly as the
 * app persists them (frequency = popcount of the day masks).
 */
const scheduledHabit = (
  schedules: ScheduleInfo[],
  tally: Tally = {},
): BoardProgressHabit => ({
  goal: {
    regularity: "week",
    frequency:
      schedules.reduce((sum, s) => sum + popcount(s.days ?? 0), 0) || 1,
  },
  schedules,
  doneToday: 0,
  skippedToday: 0,
  ...tally,
});

interface Scenario {
  name: string;
  habits: BoardProgressHabit[];
  now?: Date;
  expected: number;
  done: number;
  percent: number;
  extras?: number;
  nothingDue?: boolean;
  doneEarly?: number;
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
    habits: [{ goal: null, schedules: [], doneToday: 5, skippedToday: 0 }],
    expected: 0,
    done: 0,
    percent: 0,
    extras: 0,
  },

  // ── Time of day is ignored — the reported bug ────────────────────────────
  {
    name: "a 9:30pm slot checked in at 1pm → 100% (clock ignored), flagged early",
    habits: [
      scheduledHabit([slot({ hour: 21, minute: 30 })], { doneToday: 1 }),
    ],
    expected: 1,
    done: 1,
    percent: 100,
    doneEarly: 1,
  },
  {
    name: "a 9:30pm slot not yet done → still counts as due today",
    habits: [scheduledHabit([slot({ hour: 21, minute: 30 })])],
    expected: 1,
    done: 0,
    percent: 0,
    doneEarly: 0,
  },
  {
    name: "morning + evening, both checked in at midday → 100%, evening is early",
    habits: [
      scheduledHabit([slot({ hour: 9 }), slot({ hour: 21 })], { doneToday: 2 }),
    ],
    expected: 2,
    done: 2,
    percent: 100,
    doneEarly: 1,
  },
  {
    name: "every-day 9/12/21 → all 3 due regardless of time, 1 done → 1/3, not early",
    habits: [
      scheduledHabit(
        [slot({ hour: 9 }), slot({ hour: 12 }), slot({ hour: 21 })],
        { doneToday: 1 },
      ),
    ],
    expected: 3,
    done: 1,
    percent: 33,
    doneEarly: 0,
  },

  // ── Frequency habits (a count, no schedule rows) ─────────────────────────
  {
    name: "daily x3, 1 done → 1/3",
    habits: [freqHabit("day", 3, { doneToday: 1 })],
    expected: 3,
    done: 1,
    percent: 33,
  },
  {
    name: "daily x2, over-done caps at expected",
    habits: [freqHabit("day", 2, { doneToday: 5 })],
    expected: 2,
    done: 2,
    percent: 100,
    extras: 3,
  },
  {
    name: "daily x3, 1 done 1 skip → skip leaves the denominator → 1/2",
    habits: [freqHabit("day", 3, { doneToday: 1, skippedToday: 1 })],
    expected: 2,
    done: 1,
    percent: 50,
  },
  {
    name: "weekly x3 (no schedule) → not a today thing, nothing due",
    habits: [freqHabit("week", 3, { doneToday: 1 })],
    expected: 0,
    done: 0,
    percent: 0,
    extras: 1,
    nothingDue: true,
  },
  {
    name: "monthly x2 (no schedule) → not a today thing, nothing due",
    habits: [freqHabit("month", 2)],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDue: true,
  },

  // ── Weekday masks pin a slot to its days ─────────────────────────────────
  {
    name: "weekend-only schedule on a Wednesday → not due",
    habits: [
      scheduledHabit([
        slot({ days: Day.Sat | Day.Sun, hour: 8 }),
        slot({ days: Day.Sat | Day.Sun, hour: 14 }),
      ]),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDue: true,
  },
  {
    name: "pinned to Wed → due on a Wednesday",
    habits: [
      scheduledHabit([slot({ days: Day.Wed, hour: 9 })], { doneToday: 1 }),
    ],
    expected: 1,
    done: 1,
    percent: 100,
  },
  {
    name: "pinned to Mon → NOT due on a Wednesday (regression)",
    habits: [scheduledHabit([slot({ days: Day.Mon, hour: 9 })])],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDue: true,
  },

  // ── Skips remove a slot from the denominator ─────────────────────────────
  {
    name: "skip removes a due slot: 2 due, 1 skipped → 0/1",
    habits: [
      scheduledHabit([slot({ hour: 8 }), slot({ hour: 9 })], {
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
      scheduledHabit([slot({ hour: 8 }), slot({ hour: 9 })], {
        doneToday: 1,
        skippedToday: 1,
      }),
    ],
    expected: 1,
    done: 1,
    percent: 100,
  },
  {
    name: "everything due is skipped → habit drops out, nothing due",
    habits: [
      scheduledHabit([slot({ hour: 8 }), slot({ hour: 9 })], {
        skippedToday: 2,
      }),
    ],
    expected: 0,
    done: 0,
    percent: 0,
    nothingDue: true,
  },

  // ── Aggregation across habits ────────────────────────────────────────────
  {
    name: "per-habit cap stops an over-done habit masking an under-done one",
    habits: [
      scheduledHabit([slot({ hour: 9 })], { doneToday: 5 }),
      scheduledHabit([slot({ hour: 9 })], { doneToday: 0 }),
    ],
    expected: 2,
    done: 1,
    percent: 50,
    extras: 4,
  },
  {
    name: "mixed board: daily count partly done, scheduled off-day, scheduled today",
    habits: [
      freqHabit("day", 2, { doneToday: 1 }),
      scheduledHabit([slot({ days: Day.Mon, hour: 9 })]),
      scheduledHabit([slot({ days: Day.Wed, hour: 9 })], { doneToday: 1 }),
    ],
    expected: 3,
    done: 2,
    percent: 67,
  },
];

describe("boardProgress", () => {
  for (const s of scenarios) {
    it(s.name, () => {
      const r = boardProgress(s.habits, s.now ?? WED_1300);
      expect(r.expected).toBe(s.expected);
      expect(r.done).toBe(s.done);
      expect(r.percent).toBe(s.percent);
      if (s.extras !== undefined) expect(r.extras).toBe(s.extras);
      if (s.nothingDue !== undefined) expect(r.nothingDue).toBe(s.nothingDue);
      if (s.doneEarly !== undefined) expect(r.doneEarly).toBe(s.doneEarly);
    });
  }

  it("nothingDue is false on an empty board", () => {
    expect(boardProgress([], WED_1300).nothingDue).toBe(false);
  });
});
