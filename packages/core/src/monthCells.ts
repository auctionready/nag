import { getDaysInMonth } from "date-fns";

export interface MonthDayCell {
  dayNumber: number;
  hasCheckIn: boolean;
  /** True when every check-in for this day was a skip (no real completions). */
  isSkipped: boolean;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Builds a cell descriptor for every day in the current month, classifying
 * each as past/today/future and whether it had at least one check-in.
 */
export const buildMonthCells = (
  checkIns: { timestamp: Date; skipped?: boolean | null }[],
  now: Date = new Date(),
): MonthDayCell[] => {
  const today = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const realCheckedInDays = new Set<number>();
  const skippedOnlyDays = new Set<number>();
  for (const c of checkIns) {
    const day = c.timestamp.getDate();
    if (c.skipped) skippedOnlyDays.add(day);
    else {
      realCheckedInDays.add(day);
      skippedOnlyDays.delete(day);
    }
  }
  return Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    const isSkipped = skippedOnlyDays.has(dayNumber);
    return {
      dayNumber,
      hasCheckIn: realCheckedInDays.has(dayNumber) || isSkipped,
      isSkipped,
      isPast: dayNumber < today,
      isToday: dayNumber === today,
      isFuture: dayNumber > today,
    };
  });
};
