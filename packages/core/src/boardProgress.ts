import type { Regularity } from "@nag/schema";
import { appliesOnDay } from "./days";
import type { ScheduleInfo } from "./trafficLight";

export interface BoardProgressHabit {
  goal: { frequency: number; regularity: Regularity } | null;
  schedules: ScheduleInfo[];
  /** Non-skipped check-ins recorded today. */
  doneToday: number;
  /** Skipped check-ins recorded today. */
  skippedToday: number;
}

export interface BoardProgressResult {
  /** Sum across habits of check-ins due today, minus those skipped. */
  expected: number;
  /** Sum across habits of doneToday, capped per-habit by that habit's expected. */
  done: number;
  /** Sum across habits of check-ins beyond their expected count today. */
  extras: number;
  /** done / expected as 0..100 rounded. 0 when expected is 0. */
  percent: number;
  /** Number of habits that contributed a non-zero expected. */
  contributingHabits: number;
  /** True when at least one habit has a goal but nothing is due today. */
  nothingDue: boolean;
  /**
   * Credited check-ins that filled a slot whose clock time is still ahead of
   * `now` — i.e. done early. Copy-only; the percentage ignores time of day.
   */
  doneEarly: number;
}

/**
 * Aggregates today's progress across the board. Purely a count of check-ins
 * against what's due today — it does NOT care about the time of day, so a
 * check-in always moves the number regardless of whether the slot's clock time
 * has passed. Per-habit expectation:
 *   - scheduled habit (timed schedules) → expected = today's slots whose weekday
 *     matches (off-day slots contribute 0). The app only ever produces
 *     scheduled habits as weekly goals with a non-zero `days` mask, so the
 *     weekday filter is what pins a slot to today.
 *   - no schedules + daily goal → expected = goal.frequency
 *   - no schedules + weekly/monthly goal → contributes 0 (not a today thing)
 *   - no goal → contributes 0
 *
 * Skips resolve a due slot the same way a check-in does, but earn no credit:
 * each skip removes one outstanding slot from `expected` so skipping never drags
 * the percentage down (a fully-skipped habit drops out entirely).
 *
 * Done is capped per-habit by that habit's expected so over-done habits don't
 * mask under-done ones in the aggregate.
 *
 * `now` is used only to weekday-filter slots and to count `doneEarly` — never
 * to gate the percentage on the clock.
 */
export const boardProgress = (
  habits: BoardProgressHabit[],
  now: Date,
): BoardProgressResult => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let expected = 0;
  let done = 0;
  let extras = 0;
  let doneEarly = 0;
  let anyGoaled = false;
  let contributingHabits = 0;

  for (const h of habits) {
    if (!h.goal || h.goal.frequency <= 0) continue;
    anyGoaled = true;

    // Check-ins expected today — every slot scheduled for today's weekday,
    // regardless of clock time. `elapsedByNow` tracks how many of those slots'
    // times have already passed, purely so we can label later check-ins early.
    let dueToday = 0;
    let elapsedByNow = 0;
    if (h.schedules.length === 0) {
      if (h.goal.regularity === "day") {
        dueToday = h.goal.frequency;
        // No clock times on a frequency habit — it's due all day, so a
        // check-in is never "early".
        elapsedByNow = dueToday;
      }
    } else {
      for (const s of h.schedules) {
        if (s.hour === null || s.hour === undefined) continue;
        if (!appliesOnDay(s.days, now)) continue;
        dueToday += 1;
        const slotMinutes = s.hour * 60 + (s.minute ?? 0);
        if (slotMinutes <= nowMinutes) elapsedByNow += 1;
      }
    }

    if (dueToday === 0) {
      extras += h.doneToday;
      continue;
    }

    // Credit check-ins, then let skips clear the remaining outstanding slots so
    // they leave the denominator entirely.
    const credited = Math.min(h.doneToday, dueToday);
    const skipsResolved = Math.min(h.skippedToday, dueToday - credited);
    const habitExpected = dueToday - skipsResolved;

    extras += Math.max(0, h.doneToday - credited);
    if (habitExpected === 0) continue;

    expected += habitExpected;
    done += credited;
    // Check-ins beyond what's due by now filled a later slot → done early.
    doneEarly += Math.max(0, credited - elapsedByNow);
    contributingHabits += 1;
  }

  const percent = expected === 0 ? 0 : Math.round((done / expected) * 100);
  const nothingDue = anyGoaled && expected === 0;
  return {
    expected,
    done,
    extras,
    percent,
    contributingHabits,
    nothingDue,
    doneEarly,
  };
};
