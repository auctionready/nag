import type { Regularity } from "@nag/schema";
import type { ScheduleInfo } from "./trafficLight";

export interface BoardProgressHabit {
  goal: { frequency: number; regularity: Regularity } | null;
  schedules: ScheduleInfo[];
  /** Non-skipped check-ins recorded today. */
  doneToday: number;
}

export interface BoardProgressResult {
  /** Sum across habits of time-slots that should be done by `now`. */
  expected: number;
  /** Sum across habits of doneToday, capped per-habit by that habit's expected. */
  done: number;
  /** Sum across habits of check-ins beyond their expected count today. */
  extras: number;
  /** done / expected as 0..100 rounded. 0 when expected is 0. */
  percent: number;
  /** Number of habits that contributed a non-zero expected. */
  contributingHabits: number;
  /** True when at least one habit has a goal but nothing is due yet today. */
  nothingDueYet: boolean;
}

/**
 * Aggregates today's progress across the board. Per-habit expectation:
 *   - timed schedules → expected = today's time-slots whose hh:mm ≤ now
 *     (off-day or no time-slots-elapsed-yet ⇒ contributes 0)
 *   - no schedules + daily goal → expected = goal.frequency for the whole day
 *   - no schedules + weekly/monthly goal → contributes 0 (not a today thing)
 *   - no goal → contributes 0
 *
 * Done is capped per-habit by that habit's expected so over-done habits don't
 * mask under-done ones in the aggregate.
 */
export const boardProgress = (
  habits: BoardProgressHabit[],
  now: Date,
): BoardProgressResult => {
  const todayBit = 1 << now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let expected = 0;
  let done = 0;
  let extras = 0;
  let anyGoaled = false;
  let contributingHabits = 0;

  for (const h of habits) {
    if (!h.goal || h.goal.frequency <= 0) continue;
    anyGoaled = true;

    let habitExpected = 0;
    if (h.schedules.length === 0) {
      if (h.goal.regularity === "day") {
        habitExpected = h.goal.frequency;
      }
    } else {
      for (const s of h.schedules) {
        if (s.hour === null || s.hour === undefined) continue;
        const days = s.days ?? 0;
        if (days !== 0 && (days & todayBit) === 0) continue;
        const timeSlotMinutes = s.hour * 60 + (s.minute ?? 0);
        if (timeSlotMinutes <= nowMinutes) habitExpected += 1;
      }
    }

    if (habitExpected === 0) {
      extras += h.doneToday;
      continue;
    }

    const credited = Math.min(h.doneToday, habitExpected);
    expected += habitExpected;
    done += credited;
    extras += Math.max(0, h.doneToday - habitExpected);
    contributingHabits += 1;
  }

  const percent = expected === 0 ? 0 : Math.round((done / expected) * 100);
  const nothingDueYet = anyGoaled && expected === 0;
  return { expected, done, extras, percent, contributingHabits, nothingDueYet };
};
