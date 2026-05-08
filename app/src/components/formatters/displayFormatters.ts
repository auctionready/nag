import type { Regularity } from "@nag/schema";
import { AllDays, Day, NoDays, weekDayEntries } from "@nag/core";

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
export const cadenceLabel = (goal: {
  regularity: Regularity;
  frequency: number;
}): string => {
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

/** 24-hour hour/minute → 12-hour label, e.g. `9:00 AM`. */
export const formatTime = (hour: number, minute: number): string => {
  const m = String(minute).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${period}`;
};

/** Comma-list of day abbreviations from a day-mask, with All/None shortcuts. */
export const formatDays = (days: number): string => {
  if (days === NoDays) return "No days";
  if (days === AllDays) return "Every day";
  return weekDayEntries
    .filter(({ day }) => days & day)
    .map(({ label }) => label)
    .join(", ");
};

const WEEKDAYS_MASK = Day.Mon | Day.Tue | Day.Wed | Day.Thu | Day.Fri;
const WEEKENDS_MASK = Day.Sat | Day.Sun;

/**
 * Friendly summary for a day-mask — `every day` / `weekdays` / `weekends` /
 * `no days`, or `null` when no friendly label fits (caller renders pills).
 */
export const friendlyDaysLabel = (days: number): string | null => {
  if (days === NoDays) return "no days";
  if (days === AllDays) return "every day";
  if (days === WEEKDAYS_MASK) return "weekdays";
  if (days === WEEKENDS_MASK) return "weekends";
  return null;
};
