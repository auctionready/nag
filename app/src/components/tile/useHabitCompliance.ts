import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  checkInCount,
  checkInsInPeriod,
  recentCheckIns,
  schedulesForHabit,
} from "@nag/core";
import type { ScheduleInfo } from "@nag/core";
import { db } from "../../db";
import { periodStart } from "../getComplianceColor";
import type { HabitGoalSummary } from "./useHabitGoalSummary";

export const useHabitCompliance = (
  habitId: number,
  goal: HabitGoalSummary | null,
) => {
  const periodStartDate = goal ? periodStart(goal.regularity) : undefined;

  const { data: countRows } = useLiveQuery(
    checkInCount(db, habitId, periodStartDate),
    [habitId, periodStartDate],
  );

  const count = countRows?.[0]?.value ?? 0;

  // Day-mask / ring / within-day color need *every* check-in in the period
  // — a limited query silently drops back-fills whose `timestamp` (deemed
  // slot time) sorts earlier than newer entries.
  const { data: periodCheckInRows } = useLiveQuery(
    periodStartDate
      ? checkInsInPeriod(db, habitId, periodStartDate)
      : checkInsInPeriod(db, habitId, new Date(0)),
    [habitId, periodStartDate],
  );

  // Display text on the tile only wants the handful most recent.
  const { data: recent } = useLiveQuery(
    recentCheckIns(db, habitId, periodStartDate, 3),
    [habitId, periodStartDate],
  );

  const { data: scheduleRows } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);

  const schedules: ScheduleInfo[] = scheduleRows ?? [];

  return {
    checkInCount: count,
    /** Every check-in in the current period (for masks/rings/within-day). */
    periodCheckIns: periodCheckInRows ?? [],
    /** A short list for "X minutes ago · Y hours ago" display text only. */
    recentCheckIns: recent ?? [],
    schedules,
  };
};
