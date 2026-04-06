import {
  periodStart,
  tileColor as coreTileColor,
  type ComplianceColors,
  type ScheduleInfo,
} from "@nag/core";
import type { Regularity } from "@nag/schema";

const colors: ComplianceColors = {
  default: "#007AFF",
  compliant: "#34C759",
  partial: "#FF9500",
  failing: "#FF3B30",
};

export { periodStart };

export const tileColor = (
  goal: { frequency: number; regularity: Regularity; createdAt: Date } | null,
  checkInCount: number,
  schedules: ScheduleInfo[],
): string => coreTileColor(goal, checkInCount, schedules, colors);
