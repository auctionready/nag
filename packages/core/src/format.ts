import { format } from "date-fns";

/**
 * "h:mm am/pm" — lowercase suffix to match Nag's design vocabulary.
 * Used for both time-slot times (hour/minute pairs from schedules) and
 * matched check-in timestamps.
 */
const TIME_OF_DAY_12 = "h:mm aaa";

/** "14:05" — zero-padded, no suffix. */
const TIME_OF_DAY_24 = "HH:mm";

const timeOfDay = (use24Hour: boolean) =>
  use24Hour ? TIME_OF_DAY_24 : TIME_OF_DAY_12;

/**
 * Format a schedule time-slot's time-of-day, e.g. (7, 0) → "7:00 am",
 * or "07:00" with `use24Hour`.
 */
export const formatTimeSlotTime = (
  hour: number,
  minute: number,
  use24Hour = false,
): string => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return format(d, timeOfDay(use24Hour));
};

/**
 * Format a check-in timestamp's time-of-day, e.g. "7:04 am", or "07:04"
 * with `use24Hour`.
 */
export const formatTimeOfDay = (date: Date, use24Hour = false): string =>
  format(date, timeOfDay(use24Hour));
