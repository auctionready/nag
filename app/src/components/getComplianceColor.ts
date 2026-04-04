import {
  periodStart,
  tileColor as coreTileColor,
  type ComplianceColors,
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
): string => coreTileColor(goal, checkInCount, colors);
