import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { type Regularity } from "@nag/schema";

const DEFAULT_COLOR = "#007AFF";
const GREEN = "#34C759";
const ORANGE = "#FF9500";
const RED = "#FF3B30";

function colorForRatio(ratio: number): string {
  if (ratio >= 1) return GREEN;
  if (ratio >= 0.5) return ORANGE;
  return RED;
}

export function periodStart(regularity: Regularity, now = new Date()): string {
  const starts: Record<Regularity, () => Date> = {
    day: () => startOfDay(now),
    week: () => startOfWeek(now, { weekStartsOn: 1 }),
    month: () => startOfMonth(now),
  };
  return starts[regularity]().toISOString();
}

export function tileColor(
  goal: { frequency: number; regularity: string; createdAt: string } | null,
  checkInCount: number,
): string {
  if (!goal) return DEFAULT_COLOR;
  const start = periodStart(goal.regularity as Regularity);
  if (goal.createdAt >= start) return DEFAULT_COLOR;
  return colorForRatio(checkInCount / goal.frequency);
}
