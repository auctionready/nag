import type { MatchCheckInsToTimeSlotsResult } from "./trafficLight";

/**
 * Whether a habit's tile should show the alarm-bell badge today, and how:
 *
 *   - `None`    — no timed schedule fires today, so no bell.
 *   - `Armed`   — a clock-time nag is set for today and nothing has lapsed
 *                 (slots are upcoming or already done). Neutral outline bell.
 *   - `Overdue` — at least one timed slot's time has passed without a matching
 *                 check-in. The nag is "ringing" (same signal as
 *                 `overdueHabitsCount`). Filled orange bell.
 *
 * The bell deliberately tracks *timed* schedules only — a "do this at 8am" nag —
 * not "due sometime today" frequency goals, which the week strip already shows.
 */
export enum ScheduleAlarmStatus {
  None = "none",
  Armed = "armed",
  Overdue = "overdue",
}

export const scheduleAlarmStatus = (
  timeSlots: MatchCheckInsToTimeSlotsResult | null,
): ScheduleAlarmStatus => {
  if (!timeSlots || timeSlots.total === 0) return ScheduleAlarmStatus.None;
  return timeSlots.timeSlots.some((slot) => slot.status === "missed")
    ? ScheduleAlarmStatus.Overdue
    : ScheduleAlarmStatus.Armed;
};
