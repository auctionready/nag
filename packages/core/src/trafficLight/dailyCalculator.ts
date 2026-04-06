import { startOfDay } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";

export const dailyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, checkInCount, now } = input;
  const dayStart = startOfDay(now);
  const periodRatio = checkInCount / frequency;

  if (createdAt >= dayStart) {
    return {
      ...defaultResult(colors),
      periodProgress: Math.min(periodRatio, 1),
    };
  }

  return resultForRatio(periodRatio, periodRatio, colors);
};
