import type { ScheduleInfo } from "@nag/core";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const popcount = (n: number) => {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
};

export interface ComputeRingProgressInput {
  /** True if the habit has a day-of-week schedule (`hasSchedule` in HabitTile). */
  hasSchedule: boolean;
  /** Combined day-of-week bitmask across all schedules. */
  scheduledDaysMask: number;
  schedules: ScheduleInfo[];
  /** Check-in timestamps available to the tile (may be truncated for weekly habits). */
  recentCheckIns: { timestamp: Date }[];
  /** Total goal frequency per period (e.g. 3 for "3/week"). */
  frequency: number;
  /** Progress against the full regularity period (day/week/month), already clamped 0–1. */
  periodProgress: number;
  now: Date;
}

/**
 * Progress value shown in the tile's corner donut ring.
 *
 * - For habits with a day-of-week schedule, this is "progress within today":
 *   today's check-ins divided by today's required check-ins. Required-today
 *   comes from the count of timed schedules firing today if any exist,
 *   otherwise the per-day share of the weekly frequency (rounded up).
 * - For non-scheduled habits, this is the period progress (check-ins vs
 *   regularity frequency) supplied by the traffic-light calculator.
 */
export const computeRingProgress = ({
  hasSchedule,
  scheduledDaysMask,
  schedules,
  recentCheckIns,
  frequency,
  periodProgress,
  now,
}: ComputeRingProgressInput): number => {
  if (!hasSchedule) return periodProgress;

  const todayBit = 1 << now.getDay();
  if ((scheduledDaysMask & todayBit) === 0) return 0;

  const checkInsToday = recentCheckIns.filter((c) =>
    isSameDay(c.timestamp, now),
  ).length;

  const timedForToday = schedules.filter((s) => {
    if (s.hour === null || s.hour === undefined) return false;
    const days = s.days ?? 0;
    return days === 0 || (days & todayBit) !== 0;
  });

  const requiredToday =
    timedForToday.length > 0
      ? timedForToday.length
      : Math.max(1, Math.ceil(frequency / popcount(scheduledDaysMask)));

  return Math.min(1, checkInsToday / requiredToday);
};
