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
export { withinDayCompliance, withinDayColor } from "./withinDayCompliance";
export type {
  WithinDayCompliance,
  WithinDayComplianceInput,
} from "./withinDayCompliance";
export { matchCheckInsToSlots } from "./matchCheckInsToSlots";
export type {
  SlotStatus,
  SlotState,
  MatchCheckInsToSlotsInput,
  MatchCheckInsToSlotsResult,
} from "./matchCheckInsToSlots";
export {
  isBackfill,
  isPastDay,
  isFutureSlot,
  hasLaterCheckIn,
  nextSlotAlreadyPassed,
  halfGapElapsed,
} from "./isBackfill";
export type { IsBackfillArgs } from "./isBackfill";
export { dailyCalculator } from "./dailyCalculator";
export { weeklyCalculator } from "./weeklyCalculator";
export { monthlyCalculator } from "./monthlyCalculator";

export const isScheduledToday = (
  schedules: ScheduleInfo[],
  now = new Date(),
): boolean => {
  const combinedDays = schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);
  if (combinedDays === 0) return true;
  return (combinedDays & (1 << now.getDay())) !== 0;
};

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
