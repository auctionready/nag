import { getDaysInMonth } from "date-fns";

export interface MonthDayCell {
  dayNumber: number;
  hasCheckIn: boolean;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Builds a cell descriptor for every day in the current month, classifying
 * each as past/today/future and whether it had at least one check-in.
 */
export const buildMonthCells = (
  checkIns: { timestamp: Date }[],
  now: Date = new Date(),
): MonthDayCell[] => {
  const today = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const checkedInDays = new Set(checkIns.map((c) => c.timestamp.getDate()));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    return {
      dayNumber,
      hasCheckIn: checkedInDays.has(dayNumber),
      isPast: dayNumber < today,
      isToday: dayNumber === today,
      isFuture: dayNumber > today,
    };
  });
};
