import type { Regularity } from "@nag/schema";
import type {
  ComplianceColors,
  ScheduleInfo,
  TrafficLightCalculator,
  TrafficLightInput,
  TrafficLightResult,
} from "./types";
import { dailyCalculator } from "./dailyCalculator";
import { weeklyCalculator } from "./weeklyCalculator";
import { monthlyCalculator } from "./monthlyCalculator";

export type {
  ComplianceColors,
  ScheduleInfo,
  TrafficLightCalculator,
  TrafficLightInput,
  TrafficLightResult,
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
): TrafficLightResult => {
  if (!goal) return { color: colors.default, progress: 0, periodProgress: 0 };

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
