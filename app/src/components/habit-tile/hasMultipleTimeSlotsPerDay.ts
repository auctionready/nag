import type { ScheduleInfo } from "@nag/core";

/**
 * True when at least one day-of-week is covered by more than one schedule
 * row — i.e. the habit is scheduled multiple times on the same day. Used by
 * the tile chip to decide whether to collapse weekly progress to today-only,
 * since N=frequency dots can't represent multi-time-slot days meaningfully.
 */
export const hasMultipleTimeSlotsPerDay = (
  schedules: ScheduleInfo[],
): boolean => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of schedules) {
    const days = s.days ?? 0;
    for (let i = 0; i < 7; i++) {
      if (days & (1 << i)) counts[i] += 1;
    }
  }
  return counts.some((c) => c > 1);
};
