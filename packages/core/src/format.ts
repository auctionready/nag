import { format } from "date-fns";

/**
 * "h:mm am/pm" — lowercase suffix to match Nag's design vocabulary.
 * Used for both slot times (hour/minute pairs from schedules) and
 * matched check-in timestamps.
 */
const TIME_OF_DAY = "h:mm aaa";

/**
 * Format a schedule slot's time-of-day, e.g. (7, 0) → "7:00 am".
 */
export const formatSlotTime = (hour: number, minute: number): string => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return format(d, TIME_OF_DAY);
};

/**
 * Format a check-in timestamp's time-of-day, e.g. "7:04 am".
 */
export const formatTimeOfDay = (date: Date): string =>
  format(date, TIME_OF_DAY);
