import { isSameDay } from "date-fns";
import type { MatchCheckInsToTimeSlotsResult, TimeSlotState } from "@nag/core";
import { timeSlotStripStates, type TimeSlotDotState } from "./timeSlotDotState";

// "Recently missed" window: a missed time-slot whose scheduled time was within the
// last 90 minutes still has emotional gravity (orange ring) — older missed
// time-slots fade to a muted dot.
export const RECENT_MISS_WINDOW_MIN = 90;

/**
 * Builds today's time-slot pip states for the tile's TodayTime-slots row. Returns
 * undefined when the habit doesn't have multiple time-slots in a day —
 * single-time-slot habits don't need the pip strip.
 *
 * Two modes:
 * - Scheduled habits with multiple timed time-slots today: map snap.time-slots'
 *   per-time-slot status (`done`/`upcoming`/`missed`/`skipped`) to dot states.
 *   A time-slot whose time is past but very recent → `behind`; older → `missed`.
 * - Daily-frequency habits with `frequency > 1` and no schedules: synthesise
 *   `frequency` pips from today's check-in count — first N done, rest pending,
 *   any extras as `ahead` pips.
 */
export const computeTodayTimeSlots = (
  goal: { regularity: string; frequency: number } | null,
  timeSlots: MatchCheckInsToTimeSlotsResult | null,
  weekCheckIns: { timestamp: Date }[],
  scheduleCount: number,
  now: Date,
): TimeSlotDotState[] | undefined => {
  if (!goal) return undefined;

  // Scheduled habits with multiple timed time-slots today.
  if (timeSlots && timeSlots.total > 1) {
    return timeSlots.timeSlots.map((s) => mapTimeSlotStatus(s, now));
  }

  // Daily frequency > 1 with no schedules → synthesise pips from today's
  // check-in count.
  if (goal.regularity === "day" && goal.frequency > 1 && scheduleCount === 0) {
    const todayCount = weekCheckIns.filter((c) =>
      isSameDay(c.timestamp, now),
    ).length;
    return [...timeSlotStripStates(goal.frequency, todayCount)];
  }

  return undefined;
};

/**
 * Maps a scheduled time-slot's status to its TodayTime-slots pip dot state.
 * Recently-missed time-slots (within `RECENT_MISS_WINDOW_MIN` minutes) read as
 * `behind` (action overdue) before fading to `missed`.
 */
export const mapTimeSlotStatus = (
  timeSlot: TimeSlotState,
  now: Date,
): TimeSlotDotState => {
  if (timeSlot.status === "done" || timeSlot.status === "skipped")
    return "done";
  if (timeSlot.status === "upcoming") return "pending";
  // status === "missed"
  const timeSlotMinutes = timeSlot.hour * 60 + timeSlot.minute;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const elapsed = nowMinutes - timeSlotMinutes;
  return elapsed <= RECENT_MISS_WINDOW_MIN ? "behind" : "missed";
};
