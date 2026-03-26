import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { type Regularity } from "@nag/schema";

export interface ComplianceColors {
  default: string;
  compliant: string;
  partial: string;
  failing: string;
}

export function periodStart(
  regularity: Regularity,
  now = new Date(),
): string {
  const starts: Record<Regularity, () => Date> = {
    day: () => startOfDay(now),
    week: () => startOfWeek(now, { weekStartsOn: 1 }),
    month: () => startOfMonth(now),
  };
  return starts[regularity]().toISOString();
}

export function colorForRatio(
  ratio: number,
  colors: ComplianceColors,
): string {
  if (ratio >= 1) return colors.compliant;
  if (ratio >= 0.5) return colors.partial;
  return colors.failing;
}

export function tileColor(
  goal: { frequency: number; regularity: string; createdAt: string } | null,
  checkInCount: number,
  colors: ComplianceColors,
): string {
  if (!goal) return colors.default;
  const start = periodStart(goal.regularity as Regularity);
  if (goal.createdAt >= start) return colors.default;
  return colorForRatio(checkInCount / goal.frequency, colors);
}
