import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import type { Regularity } from "@nag/schema";

export interface ComplianceColors {
  default: string;
  compliant: string;
  partial: string;
  failing: string;
}

export function periodStart(regularity: Regularity, now = new Date()): Date {
  const starts: Record<Regularity, () => Date> = {
    day: () => startOfDay(now),
    week: () => startOfWeek(now, { weekStartsOn: 1 }),
    month: () => startOfMonth(now),
  };
  return starts[regularity]();
}

export function colorForRatio(ratio: number, colors: ComplianceColors): string {
  if (ratio >= 1) return colors.compliant;
  if (ratio >= 0.5) return colors.partial;
  return colors.failing;
}

export function tileColor(
  goal: { frequency: number; regularity: Regularity; createdAt: Date } | null,
  checkInCount: number,
  colors: ComplianceColors,
): string {
  if (!goal) return colors.default;
  const start = periodStart(goal.regularity);
  if (goal.createdAt >= start) return colors.default;
  return colorForRatio(checkInCount / goal.frequency, colors);
}
