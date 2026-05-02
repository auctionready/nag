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
  weekCheckIns: { timestamp: Date }[],
  frequency: number,
): DailyWeekClassification => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of weekCheckIns) {
    counts[c.timestamp.getDay()] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  const target = Math.max(1, frequency);
  for (let dow = 0; dow < 7; dow++) {
    const n = counts[dow];
    if (n >= target) completedDaysMask |= DAY_BITS[dow];
    else if (n > 0) partialDaysMask |= DAY_BITS[dow];
  }
  return { completedDaysMask, partialDaysMask };
};
