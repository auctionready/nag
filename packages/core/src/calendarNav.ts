import {
  addDays,
  addMonths,
  isAfter,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

/** Which window the calendar is showing: a whole month or a single week. */
export type CalendarView = "month" | "week";

/** Step one period earlier (`prev`) or later (`next`). */
export type CalendarStepDirection = "prev" | "next";

/**
 * The new base day after stepping one period in `direction`: ±1 month in
 * month view, ±7 days in week view. Pure date math with no clamping —
 * callers gate forward steps with {@link canStepForward} and/or clamp the
 * result with {@link clampDayToToday}.
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
 */
export const canStepForward = (
  day: Date,
  view: CalendarView,
  today: Date,
): boolean => {
  const next = stepCalendarDay({ day, view, direction: "next" });
  if (view === "month") {
    return !isAfter(startOfMonth(next), startOfMonth(today));
  }
  return !isAfter(
    startOfWeek(next, { weekStartsOn: 1 }),
    startOfWeek(today, { weekStartsOn: 1 }),
  );
};
