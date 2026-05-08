import { isSameDay } from "date-fns";
import type { MatchCheckInsToSlotsResult, SlotState } from "@nag/core";
import { slotStripStates, type SlotDotState } from "./slotDotState";

// "Recently missed" window: a missed slot whose scheduled time was within the
// last 90 minutes still has emotional gravity (orange ring) — older missed
// slots fade to a muted dot.
export const RECENT_MISS_WINDOW_MIN = 90;

/**
 * Builds today's slot pip states for the tile's TodaySlots row. Returns
 * undefined when the habit doesn't have multiple slots in a day —
 * single-slot habits don't need the pip strip.
 *
 * Two modes:
 * - Scheduled habits with multiple timed slots today: map snap.slots'
 *   per-slot status (`done`/`upcoming`/`missed`/`skipped`) to dot states.
 *   A slot whose time is past but very recent → `behind`; older → `missed`.
 * - Daily-frequency habits with `frequency > 1` and no schedules: synthesise
 *   `frequency` pips from today's check-in count — first N done, rest pending,
 *   any extras as `ahead` pips.
 */
export const computeTodaySlots = (
  goal: { regularity: string; frequency: number } | null,
  slots: MatchCheckInsToSlotsResult | null,
  weekCheckIns: { timestamp: Date }[],
  scheduleCount: number,
  now: Date,
): SlotDotState[] | undefined => {
  if (!goal) return undefined;

  // Scheduled habits with multiple timed slots today.
  if (slots && slots.total > 1) {
    return slots.slots.map((s) => mapSlotStatus(s, now));
  }

  // Daily frequency > 1 with no schedules → synthesise pips from today's
  // check-in count.
  if (goal.regularity === "day" && goal.frequency > 1 && scheduleCount === 0) {
    const todayCount = weekCheckIns.filter((c) =>
      isSameDay(c.timestamp, now),
    ).length;
    return [...slotStripStates(goal.frequency, todayCount)];
  }

  return undefined;
};

/**
 * Maps a scheduled slot's status to its TodaySlots pip dot state.
 * Recently-missed slots (within `RECENT_MISS_WINDOW_MIN` minutes) read as
 * `behind` (action overdue) before fading to `missed`.
 */
export const mapSlotStatus = (slot: SlotState, now: Date): SlotDotState => {
  if (slot.status === "done" || slot.status === "skipped") return "done";
  if (slot.status === "upcoming") return "pending";
  // status === "missed"
  const slotMinutes = slot.hour * 60 + slot.minute;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const elapsed = nowMinutes - slotMinutes;
  return elapsed <= RECENT_MISS_WINDOW_MIN ? "behind" : "missed";
};
