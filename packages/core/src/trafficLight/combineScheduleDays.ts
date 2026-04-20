import type { ScheduleInfo } from "./types";

/**
 * Bitwise OR of every schedule's `days` field (Sun=bit0..Sat=bit6).
 * Returns 0 when no schedule has any day-of-week set, which by
 * convention means "every day" — see `isScheduledToday`.
 */
export const combineScheduleDays = (schedules: ScheduleInfo[]): number =>
  schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);
