import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { checkInCount, recentCheckIns, schedulesForHabit } from "@nag/core";
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

  const recentLimit = goal?.regularity === "week" ? 7 : 3;

  const { data: recent } = useLiveQuery(
    recentCheckIns(db, habitId, periodStartDate, recentLimit),
    [habitId, periodStartDate, recentLimit],
  );

  const { data: scheduleRows } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);

  const schedules: ScheduleInfo[] = scheduleRows ?? [];

  return {
    checkInCount: count,
    recentCheckIns: recent ?? [],
    schedules,
  };
};
