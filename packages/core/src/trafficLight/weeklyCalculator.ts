import { startOfWeek, differenceInCalendarDays } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { combineScheduleDays } from "./combineScheduleDays";
import { resultForRatio, defaultResult } from "./colorForRatio";

/** Week order starting Monday, using Date.getDay() values */
const weekOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 .. Sun=0

/**
 * Count how many scheduled days have elapsed from Monday through today
 * (inclusive) based on the days bitmask where bits map to Day enum:
 * Sun=1<<0, Mon=1<<1, Tue=1<<2, Wed=1<<3, Thu=1<<4, Fri=1<<5, Sat=1<<6
 */
const expectedFromSchedule = (daysBitmask: number, now: Date): number => {
  const today = now.getDay();
  const todayIndex = weekOrder.indexOf(today);
  let count = 0;
  for (let i = 0; i <= todayIndex; i++) {
    const bit = 1 << weekOrder[i];
    if (daysBitmask & bit) count++;
  }
  return count;
};

/**
 * Sliding window for unscheduled weekly habits.
 * Proportional expected = frequency * (daysElapsed / 7), minimum 1 so
 * the habit is always trackable once the period begins.
 */
const expectedFromWindow = (frequency: number, now: Date): number => {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const daysElapsed = differenceInCalendarDays(now, weekStart) + 1; // 1-based
  return Math.max(1, Math.ceil(frequency * (daysElapsed / 7)));
};

export const weeklyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, schedules, checkInCount, now } = input;
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  if (createdAt >= weekStart) {
    return {
      ...defaultResult(colors),
      periodProgress: Math.min(checkInCount / frequency, 1),
    };
  }

  const combinedDays = combineScheduleDays(schedules);

  const expected =
    combinedDays !== 0
      ? expectedFromSchedule(combinedDays, now)
      : expectedFromWindow(frequency, now);

  if (expected === 0) return defaultResult(colors);

  return resultForRatio(
    checkInCount / expected,
    checkInCount / frequency,
    colors,
  );
};
