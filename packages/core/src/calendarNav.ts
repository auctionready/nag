import {
  addDays,
  addMonths,
  format,
  isAfter,
  parse,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

/**
 * Which window the calendar is showing: a whole month, a single week, or a
 * single day. Day view drives a per-habit per-slot agenda for that date.
 */
export type CalendarView = "day" | "month" | "week";

/** `yyyy-MM-dd` — the calendar `?day=` route param and notification payload. */
const DAY_PARAM_FORMAT = "yyyy-MM-dd";

/** Format a date as the `yyyy-MM-dd` calendar route param. */
export const formatDayParam = (day: Date): string =>
  format(day, DAY_PARAM_FORMAT);

/**
 * Parse a `yyyy-MM-dd` calendar route param into a local date, anchored to
 * `reference` (typically the start of today) for the time-of-day fields.
 */
export const parseDayParam = (param: string, reference: Date): Date =>
  parse(param, DAY_PARAM_FORMAT, reference);

/** Step one period earlier (`prev`) or later (`next`). */
export type CalendarStepDirection = "prev" | "next";

/**
 * The new base day after stepping one period in `direction`: ±1 month in
 * month view, ±7 days in week view, ±1 day in day view. Pure date math
 * with no clamping — callers gate forward steps with {@link canStepForward}
 * and/or clamp the result with {@link clampDayToToday}.
 */
export const stepCalendarDay = ({
  day,
  view,
  direction,
}: {
  day: Date;
  view: CalendarView;
  direction: CalendarStepDirection;
}): Date => {
  if (view === "month") {
    return direction === "next" ? addMonths(day, 1) : subMonths(day, 1);
  }
  if (view === "day") {
    return direction === "next" ? addDays(day, 1) : subDays(day, 1);
  }
  return direction === "next" ? addDays(day, 7) : subDays(day, 7);
};

/** `day` pulled back to `today` if it would otherwise land in the future. */
export const clampDayToToday = (day: Date, today: Date): Date =>
  isAfter(day, today) ? today : day;

/**
 * Whether stepping forward one period from `day` stays within today's
 * period — i.e. the "next" control should be enabled. Compares month
 * starts in month view and Monday-anchored week starts in week view, so
 * the current (partial) period is always reachable but future ones aren't.
 *
 * Day view is always steppable forward: users can view a future day's
 * scheduled list (read-only) per the design.
 */
export const canStepForward = (
  day: Date,
  view: CalendarView,
  today: Date,
): boolean => {
  if (view === "day") return true;
  const next = stepCalendarDay({ day, view, direction: "next" });
  if (view === "month") {
    return !isAfter(startOfMonth(next), startOfMonth(today));
  }
  return !isAfter(
    startOfWeek(next, { weekStartsOn: 1 }),
    startOfWeek(today, { weekStartsOn: 1 }),
  );
};
