import type { MatchCheckInsToTimeSlotsResult } from "./trafficLight";

/**
 * Whether a habit's tile should show the alarm-bell badge today, and how:
 *
 *   - "none"    — no timed schedule fires today, so no bell.
 *   - "armed"   — a clock-time nag is set for today and nothing has lapsed
 *                 (slots are upcoming or already done). Neutral outline bell.
 *   - "overdue" — at least one timed slot's time has passed without a matching
 *                 check-in. The nag is "ringing" (same signal as
 *                 `overdueHabitsCount`). Filled orange bell.
 *
 * The bell deliberately tracks *timed* schedules only — a "do this at 8am" nag —
 * not "due sometime today" frequency goals, which the week strip already shows.
 */
export type ScheduleAlarmState = "none" | "armed" | "overdue";

export const scheduleAlarmState = (
  timeSlots: MatchCheckInsToTimeSlotsResult | null,
): ScheduleAlarmState => {
  if (!timeSlots || timeSlots.total === 0) return "none";
  return timeSlots.timeSlots.some((slot) => slot.status === "missed")
    ? "overdue"
    : "armed";
};
