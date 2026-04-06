import { startOfDay } from "date-fns";
import type { TrafficLightCalculator } from "./types";
import { colorForRatio } from "./colorForRatio";

export const dailyCalculator: TrafficLightCalculator = (input, colors) => {
  const { frequency, createdAt, checkInCount, now } = input;
  const dayStart = startOfDay(now);

  if (createdAt >= dayStart) return colors.default;

  return colorForRatio(checkInCount / frequency, colors);
};
