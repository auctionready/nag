import { startOfDay } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";

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
  const timed = schedules.filter(
    (s) => s.hour !== null && s.hour !== undefined,
  );
  if (timed.length > 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const elapsed = timed.filter(
      (s) => (s.hour ?? 0) * 60 + (s.minute ?? 0) <= nowMinutes,
    ).length;
    if (elapsed === 0) {
      return {
        ...defaultResult(colors),
        periodProgress: periodRatio,
      };
    }
    const ratio = checkInCount / elapsed;
    return resultForRatio(ratio, periodRatio, colors);
  }

  return resultForRatio(periodRatio, periodRatio, colors);
};
