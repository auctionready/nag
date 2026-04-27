import { startOfMonth, getDaysInMonth } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";

/**
 * Count how many scheduled days-of-month have fully elapsed (strictly before
 * today). Today is in progress and not counted.
 */
const expectedFromSchedule = (
  dayOfMonthValues: number[],
  now: Date,
): number => {
  const today = now.getDate();
  return dayOfMonthValues.filter((d) => d < today).length;
};

/**
 * Sliding window for unscheduled monthly habits.
 * Pace by completed days: today is in progress and does not count.
 * Returns 0 on the first of the month so the tile stays neutral until the
 * user has actually fallen behind.
 */
const expectedFromWindow = (frequency: number, now: Date): number => {
  const daysCompleted = now.getDate() - 1; // 1st of month -> 0 completed
  const totalDays = getDaysInMonth(now);
  return Math.ceil(frequency * (daysCompleted / totalDays));
};

export const monthlyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, schedules, checkInCount, now } = input;
  const monthStart = startOfMonth(now);

  if (createdAt >= monthStart) {
    return {
      ...defaultResult(colors),
      periodProgress: Math.min(checkInCount / frequency, 1),
    };
  }

  const dayOfMonthValues = schedules
    .map((s) => s.dayOfMonth)
    .filter((d): d is number => d != null);

  const expected =
    dayOfMonthValues.length > 0
      ? expectedFromSchedule(dayOfMonthValues, now)
      : expectedFromWindow(frequency, now);

  if (expected === 0) {
    return {
      ...defaultResult(colors),
      periodProgress: Math.min(checkInCount / frequency, 1),
    };
  }

  return resultForRatio(
    checkInCount / expected,
    checkInCount / frequency,
    colors,
  );
};
