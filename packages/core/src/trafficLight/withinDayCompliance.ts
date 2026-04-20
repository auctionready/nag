import { isSameCalendarDay } from "../days";
import type { ScheduleInfo, ComplianceColors } from "./types";
import { colorForRatio } from "./colorForRatio";

export interface WithinDayComplianceInput {
  schedules: ScheduleInfo[];
  checkInTimestamps: Date[];
  now: Date;
}

export interface WithinDayCompliance {
  /** Number of timed schedules for today whose time is <= now. */
  elapsed: number;
  /** Number of check-ins that occurred today. */
  checkInsToday: number;
  /** elapsed > 0 ? checkInsToday / elapsed : null */
  ratio: number | null;
}

/**
 * Computes within-day compliance for habits with multiple timed schedules
 * per day. Looks at how many of today's scheduled times have elapsed and
 * how many check-ins have occurred today.
 *
 * Schedules without an `hour` are ignored. Schedules whose `days` mask
 * does not include today are ignored. If `days` is null/0 the schedule is
 * treated as applying every day.
 */
export const withinDayCompliance = ({
  schedules,
  checkInTimestamps,
  now,
}: WithinDayComplianceInput): WithinDayCompliance => {
  const todayBit = 1 << now.getDay();
  const todaysTimedSchedules = schedules.filter((s) => {
    if (s.hour === null || s.hour === undefined) return false;
    const days = s.days ?? 0;
    return days === 0 || (days & todayBit) !== 0;
  });

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const elapsed = todaysTimedSchedules.filter(
    (s) => (s.hour ?? 0) * 60 + (s.minute ?? 0) <= nowMinutes,
  ).length;

  const checkInsToday = checkInTimestamps.filter((t) =>
    isSameCalendarDay(t, now),
  ).length;

  return {
    elapsed,
    checkInsToday,
    ratio: elapsed > 0 ? checkInsToday / elapsed : null,
  };
};

/**
 * Returns a compliance color for today's progress against elapsed
 * schedules, or undefined if there are no elapsed timed schedules today.
 */
export const withinDayColor = (
  input: WithinDayComplianceInput,
  colors: ComplianceColors,
): string | undefined => {
  const { ratio } = withinDayCompliance(input);
  if (ratio === null) return undefined;
  return colorForRatio(ratio, colors);
};
