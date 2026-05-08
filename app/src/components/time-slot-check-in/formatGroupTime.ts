import { formatTimeSlotTime } from "@nag/core";
import type { TimeSlotCheckInItem } from "./TimeSlotCheckIn";

/**
 * Header label for the time-slot-check-in screen. Uses the explicit
 * (hour, minute) when supplied; otherwise falls back to the row-level
 * time-slot meta if every row shares it.
 */
export const formatGroupTime = (
  timeSlotHour: number | undefined,
  timeSlotMinute: number | undefined,
  items: TimeSlotCheckInItem[],
): string | undefined => {
  if (
    timeSlotHour !== undefined &&
    timeSlotMinute !== undefined &&
    !isNaN(timeSlotHour) &&
    !isNaN(timeSlotMinute)
  ) {
    return formatTimeSlotTime(timeSlotHour, timeSlotMinute);
  }
  const first = items[0]?.timeSlotMeta;
  if (first && items.every((i) => i.timeSlotMeta === first)) return first;
  return undefined;
};
