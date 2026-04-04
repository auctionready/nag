import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { getTitle } from "@nag/schema";
import { goalForHabit } from "@nag/core";
import { db } from "../../db";

const useHabitGoalSummary = (habitId: number) => {
  const { data: goals } = useLiveQuery(goalForHabit(db, habitId), [habitId]);

  const goalData = goals?.[0];
  if (!goalData) return null;

  return {
    regularity: goalData.regularity,
    frequency: goalData.frequency,
    title: getTitle(goalData),
    createdAt: goalData.createdAt,
  };
};

export type HabitGoalSummary = NonNullable<
  ReturnType<typeof useHabitGoalSummary>
>;

export { useHabitGoalSummary };
