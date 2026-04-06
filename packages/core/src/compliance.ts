import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import type { Regularity } from "@nag/schema";

export function periodStart(regularity: Regularity, now = new Date()): Date {
  const starts: Record<Regularity, () => Date> = {
    day: () => startOfDay(now),
    week: () => startOfWeek(now, { weekStartsOn: 1 }),
    month: () => startOfMonth(now),
  };
  return starts[regularity]();
}
