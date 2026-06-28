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
  /** Sum across habits of time-slots due today by `now`, minus those skipped. */
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
  /** True when at least one scheduled time-slot for today is still ahead of `now`. */
  hasFutureToday: boolean;
}

/**
 * Aggregates today's progress across the board. Per-habit expectation:
 *   - scheduled habit (timed schedules) → expected = today's time-slots whose
 *     weekday matches and whose hh:mm ≤ now (off-day slots contribute 0). The
 *     app only ever produces scheduled habits as weekly goals with a non-zero
 *     `days` mask, so the weekday filter is what pins a slot to today.
 *   - no schedules + daily goal → expected = goal.frequency for the whole day
 *   - no schedules + weekly/monthly goal → contributes 0 (not a today thing)
 *   - no goal → contributes 0
 *
 * Skips resolve a due slot the same way a check-in does, but earn no credit:
 * each skip removes one outstanding slot from `expected` so skipping never drags
 * the percentage down (a fully-skipped habit drops out entirely).
 *
 * Done is capped per-habit by that habit's expected so over-done habits don't
 * mask under-done ones in the aggregate.
 */
export const boardProgress = (
  habits: BoardProgressHabit[],
  now: Date,
): BoardProgressResult => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let expected = 0;
  let done = 0;
  let extras = 0;
  let anyGoaled = false;
  let contributingHabits = 0;
  let hasFutureToday = false;

  for (const h of habits) {
    if (!h.goal || h.goal.frequency <= 0) continue;
    anyGoaled = true;

    // Slots due today whose time has already elapsed.
    let dueByNow = 0;
    if (h.schedules.length === 0) {
      if (h.goal.regularity === "day") dueByNow = h.goal.frequency;
    } else {
      for (const s of h.schedules) {
        if (s.hour === null || s.hour === undefined) continue;
        if (!appliesOnDay(s.days, now)) continue;
        const slotMinutes = s.hour * 60 + (s.minute ?? 0);
        if (slotMinutes <= nowMinutes) dueByNow += 1;
        else hasFutureToday = true;
      }
    }

    if (dueByNow === 0) {
      extras += h.doneToday;
      continue;
    }

    // Credit check-ins, then let skips clear the remaining outstanding slots so
    // they leave the denominator entirely.
    const credited = Math.min(h.doneToday, dueByNow);
    const skipsResolved = Math.min(h.skippedToday, dueByNow - credited);
    const habitExpected = dueByNow - skipsResolved;

    extras += Math.max(0, h.doneToday - credited);
    if (habitExpected === 0) continue;

    expected += habitExpected;
    done += credited;
    contributingHabits += 1;
  }

  const percent = expected === 0 ? 0 : Math.round((done / expected) * 100);
  const nothingDueYet = anyGoaled && expected === 0;
  return {
    expected,
    done,
    extras,
    percent,
    contributingHabits,
    nothingDueYet,
    hasFutureToday,
  };
};
