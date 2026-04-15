/**
 * Formats a 24-hour hour/minute pair as a 12-hour label, e.g. "9:00 AM".
 */
export const formatSlotTime = (hour: number, minute: number): string => {
  const m = String(minute).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${period}`;
};
