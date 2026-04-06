import type { Regularity } from "@nag/schema";
import type {
  ComplianceColors,
  ScheduleInfo,
  TrafficLightCalculator,
  TrafficLightInput,
} from "./types";
import { dailyCalculator } from "./dailyCalculator";
import { weeklyCalculator } from "./weeklyCalculator";
import { monthlyCalculator } from "./monthlyCalculator";

export type {
  ComplianceColors,
  ScheduleInfo,
  TrafficLightCalculator,
  TrafficLightInput,
};
export { colorForRatio } from "./colorForRatio";
export { dailyCalculator } from "./dailyCalculator";
export { weeklyCalculator } from "./weeklyCalculator";
export { monthlyCalculator } from "./monthlyCalculator";

const calculators: Record<Regularity, TrafficLightCalculator> = {
  day: dailyCalculator,
  week: weeklyCalculator,
  month: monthlyCalculator,
};

export const tileColor = (
  goal: { frequency: number; regularity: Regularity; createdAt: Date } | null,
  checkInCount: number,
  schedules: ScheduleInfo[],
  colors: ComplianceColors,
  now = new Date(),
): string => {
  if (!goal) return colors.default;

  const calculator = calculators[goal.regularity];
  return calculator(
    {
      frequency: goal.frequency,
      regularity: goal.regularity,
      createdAt: goal.createdAt,
      schedules,
      checkInCount,
      now,
    },
    colors,
  );
};
