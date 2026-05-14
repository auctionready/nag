import { Day } from "@nag/core";

const DAY_BITS = [
  Day.Sun,
  Day.Mon,
  Day.Tue,
  Day.Wed,
  Day.Thu,
  Day.Fri,
  Day.Sat,
] as const;

export interface DailyWeekClassification {
  /** Bitmask of days where check-in count >= goal frequency. */
  completedDaysMask: number;
  /** Bitmask of days where 0 < check-in count < goal frequency. */
  partialDaysMask: number;
  /**
   * Bitmask of days where the user only logged skip check-ins (no real
   * completions). Such days may also be in `completedDaysMask`, so
   * renderers should check `skippedDaysMask` first.
   */
  skippedDaysMask: number;
}

/**
 * For daily habits with `frequency` check-ins-per-day, classify each day of
 * the current week as done (≥ frequency check-ins) or partial
 * (1..frequency-1).
 *
 * `frequency = 1` collapses to "done if any check-in"; `partialDaysMask` is
 * always 0 in that case.
 */
export const classifyDailyWeek = (
  weekCheckIns: { timestamp: Date; skipped?: boolean | null }[],
  frequency: number,
): DailyWeekClassification => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const skips = [0, 0, 0, 0, 0, 0, 0];
  for (const c of weekCheckIns) {
    const dow = c.timestamp.getDay();
    counts[dow] += 1;
    if (c.skipped) skips[dow] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  let skippedDaysMask = 0;
  const target = Math.max(1, frequency);
  for (let dow = 0; dow < 7; dow++) {
    const n = counts[dow];
    if (n >= target) completedDaysMask |= DAY_BITS[dow];
    else if (n > 0) partialDaysMask |= DAY_BITS[dow];
    if (skips[dow] > 0 && n - skips[dow] === 0)
      skippedDaysMask |= DAY_BITS[dow];
  }
  return { completedDaysMask, partialDaysMask, skippedDaysMask };
};
