import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfMonth,
} from "date-fns";
import type { Regularity } from "@nag/schema";

export function periodStart(regularity: Regularity, now = new Date()): Date {
  const starts: Record<Regularity, () => Date> = {
    day: () => startOfDay(now),
    week: () => startOfWeek(now, { weekStartsOn: 1 }),
    month: () => startOfMonth(now),
  };
  return starts[regularity]();
}

/**
 * Start/end of the current period for a given regularity. For `week`
 * the end is clamped to end-of-day(now) so future days don't leak in;
 * `month` returns the full month window. `day` and `null` both return
 * today's window.
 */
export const periodWindow = (
  regularity: Regularity | null,
  now = new Date(),
): { start: Date; end: Date } => {
  if (regularity === "week") {
    return { start: periodStart("week", now), end: endOfDay(now) };
  }
  if (regularity === "month") {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
  return { start: startOfDay(now), end: endOfDay(now) };
};
