import { startOfDay } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { resultForRatio, defaultResult } from "./colorForRatio";

export const dailyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, checkInCount, now } = input;
  const dayStart = startOfDay(now);

  if (createdAt >= dayStart) return defaultResult(colors);

  return resultForRatio(checkInCount / frequency, colors);
};
