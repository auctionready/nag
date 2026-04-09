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

/**
 * Lighter compliance palette for the corner progress ring. The tile
 * background already uses the saturated compliance palette, so a same-
 * color ring stroke would disappear; these pastel variants keep the
 * compliance color-coding while staying visible on top.
 */
const ringStrokeColors: ComplianceColors = {
  default: "#93C5FD",
  compliant: "#86EFAC",
  partial: "#FDBA74",
  failing: "#FCA5A5",
};

export const complianceColors = colors;

export { periodStart };

export const tileStatus = (
  goal: { frequency: number; regularity: Regularity; createdAt: Date } | null,
  checkInCount: number,
  schedules: ScheduleInfo[],
): TrafficLightResult => coreTileColor(goal, checkInCount, schedules, colors);

const tileToRingColor = new Map<string, string>([
  [colors.default, ringStrokeColors.default],
  [colors.compliant, ringStrokeColors.compliant],
  [colors.partial, ringStrokeColors.partial],
  [colors.failing, ringStrokeColors.failing],
]);

/** Map a tile compliance color to its lighter ring-stroke counterpart. */
export const ringColorForTileColor = (tileColor: string): string =>
  tileToRingColor.get(tileColor) ?? "#fff";
