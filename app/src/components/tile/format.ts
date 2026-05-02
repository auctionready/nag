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
 * Lowercase cadence label for the tile chip in text mode — "daily",
 * "2× / day", "3× / wk", "2× / mo". The chip applies uppercase via CSS.
 */
export const cadenceLabel = (goal: HabitGoalSummary): string => {
  if (goal.frequency <= 1) {
    if (goal.regularity === "day") return "daily";
    if (goal.regularity === "week") return "weekly";
    return "monthly";
  }
  return `${goal.frequency}× / ${periodWordShort[goal.regularity]}`;
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
