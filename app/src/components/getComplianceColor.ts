import {
  periodStart,
  tileColor as coreTileColor,
  type ComplianceColors,
} from "@nag/core";

const colors: ComplianceColors = {
  default: "#007AFF",
  compliant: "#34C759",
  partial: "#FF9500",
  failing: "#FF3B30",
};

export { periodStart };

export function tileColor(
  goal: { frequency: number; regularity: string; createdAt: string } | null,
  checkInCount: number,
): string {
  return coreTileColor(goal, checkInCount, colors);
}
