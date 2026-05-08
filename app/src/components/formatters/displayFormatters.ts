import type { Regularity } from "@nag/schema";
import { AllDays, NoDays, WeekDays, WeekendDays } from "@nag/core";

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

/** 24-hour hour/minute → 12-hour label, e.g. `9:00 AM`. */
export const formatTime = (hour: number, minute: number): string => {
  const m = String(minute).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${period}`;
};

/**
 * Friendly summary for a day-mask — `every day` / `weekdays` / `weekends` /
 * `no days`, or `null` when no friendly label fits (caller renders pills).
 */
export const friendlyDaysLabel = (days: number): string | null => {
  switch (days) {
    case NoDays:
      return "no days";
    case AllDays:
      return "every day";
    case WeekDays:
      return "weekdays";
    case WeekendDays:
      return "weekends";
    default:
      return null;
  }
};
