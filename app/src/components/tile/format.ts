import type { Regularity } from "@nag/schema";
import type { HabitGoalSummary } from "./useHabitGoalSummary";

export const periodLabels: Record<Regularity, string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

const periodWordShort: Record<Regularity, string> = {
  day: "day",
  week: "wk",
  month: "mo",
};

/**
 * Short uppercase cadence string for the tile chip — e.g. "DAILY",
 * "3× / WK", "2× / MO". Returns null when the habit has no goal yet.
 */
export const cadenceLabel = (
  goal: HabitGoalSummary | null,
  scheduleCount?: number,
): string | null => {
  if (!goal) return null;
  const f = goal.frequency;
  if (goal.regularity === "day") {
    return f === 1 ? "daily" : `${f}× / day`;
  }
  if (goal.regularity === "week") {
    if (scheduleCount && scheduleCount > 0 && f === scheduleCount) {
      return "scheduled";
    }
    return `${f}× / wk`;
  }
  return `${f}× / ${periodWordShort[goal.regularity]}`;
};

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

export const formatCount = (n: number): string =>
  n < smallNumbers.length ? smallNumbers[n] : String(n);
