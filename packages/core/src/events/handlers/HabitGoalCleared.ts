import { eq } from "drizzle-orm";
import { goal } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitGoalClearedPayload = { habitId: string };

export const applyHabitGoalCleared = async (
  db: AnyDb,
  payload: HabitGoalClearedPayload,
): Promise<void> => {
  await db.delete(goal).where(eq(goal.habitId, payload.habitId));
};
