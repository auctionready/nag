import type { TimeSlotState } from "@nag/core";

/**
 * Pick the time-slot the screen should focus on. Prefers an exact (hour,
 * minute) match (i.e. the time-slot the user navigated from); otherwise
 * falls back to whichever time-slot is closest to `now`.
 */
export const pickTimeSlot = (
  timeSlots: TimeSlotState[],
  timeSlotHour: number | undefined,
  timeSlotMinute: number | undefined,
  now: Date,
): TimeSlotState | undefined => {
  if (timeSlots.length === 0) return undefined;
  if (
    timeSlotHour !== undefined &&
    timeSlotMinute !== undefined &&
    !isNaN(timeSlotHour) &&
    !isNaN(timeSlotMinute)
  ) {
    const exact = timeSlots.find(
      (s) => s.hour === timeSlotHour && s.minute === timeSlotMinute,
    );
    if (exact) return exact;
  }
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return timeSlots.reduce((best, s) => {
    const d = Math.abs(s.hour * 60 + s.minute - nowMins);
    const bd = Math.abs(best.hour * 60 + best.minute - nowMins);
    return d < bd ? s : best;
  });
};
