import { startOfDay } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";
import { withinDayCompliance } from "./withinDayCompliance";

export const dailyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, checkInCount, schedules, now } = input;
  const dayStart = startOfDay(now);
  const periodRatio = Math.min(checkInCount / frequency, 1);

  if (createdAt >= dayStart) {
    return {
      ...defaultResult(colors),
      periodProgress: periodRatio,
    };
  }

  // Schedule-aware: count how many scheduled times have elapsed today.
  // We don't have individual check-in timestamps here, so we approximate
  // checkInsToday as the period checkInCount (period == today for daily).
  const fakeTimestamps = Array.from({ length: checkInCount }, () => now);
  const { elapsed } = withinDayCompliance({
    schedules,
    checkInTimestamps: fakeTimestamps,
    now,
  });

  if (elapsed > 0) {
    if (elapsed === 0) {
      return { ...defaultResult(colors), periodProgress: periodRatio };
    }
    const ratio = checkInCount / elapsed;
    return resultForRatio(ratio, periodRatio, colors);
  }

  // No timed schedules at all today, but if any schedules had hours we
  // would have used them. Otherwise fall back to frequency-based ratio.
  const hasAnyTimedSchedule = schedules.some(
    (s) => s.hour !== null && s.hour !== undefined,
  );
  if (hasAnyTimedSchedule) {
    return { ...defaultResult(colors), periodProgress: periodRatio };
  }

  return resultForRatio(periodRatio, periodRatio, colors);
};
