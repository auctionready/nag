import { startOfMonth, getDaysInMonth } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";

/**
 * Count how many scheduled days-of-month have elapsed (1 through today inclusive).
 */
const expectedFromSchedule = (
  dayOfMonthValues: number[],
  now: Date,
): number => {
  const today = now.getDate();
  return dayOfMonthValues.filter((d) => d <= today).length;
};

/**
 * Sliding window for unscheduled monthly habits.
 * Proportional expected = frequency * (daysElapsed / daysInMonth), minimum 1.
 */
const expectedFromWindow = (frequency: number, now: Date): number => {
  const today = now.getDate();
  const totalDays = getDaysInMonth(now);
  return Math.max(1, Math.ceil(frequency * (today / totalDays)));
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

  if (expected === 0) return defaultResult(colors);

  return resultForRatio(
    checkInCount / expected,
    checkInCount / frequency,
    colors,
  );
};
