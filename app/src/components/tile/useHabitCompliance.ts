import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { checkInCount, recentCheckIns } from "@nag/core";
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

  const { data: recent } = useLiveQuery(
    recentCheckIns(db, habitId, periodStartDate),
    [habitId, periodStartDate],
  );

  return {
    checkInCount: count,
    recentCheckIns: recent ?? [],
  };
};
