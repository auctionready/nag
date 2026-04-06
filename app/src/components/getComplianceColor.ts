import {
  periodStart,
  tileColor as coreTileColor,
  type ComplianceColors,
  type ScheduleInfo,
  type TrafficLightResult,
} from "@nag/core";
import type { Regularity } from "@nag/schema";

const colors: ComplianceColors = {
  default: "#007AFF",
  compliant: "#34C759",
  partial: "#FF9500",
  failing: "#FF3B30",
};

export { periodStart };

export const tileStatus = (
  goal: { frequency: number; regularity: Regularity; createdAt: Date } | null,
  checkInCount: number,
  schedules: ScheduleInfo[],
): TrafficLightResult => coreTileColor(goal, checkInCount, schedules, colors);
