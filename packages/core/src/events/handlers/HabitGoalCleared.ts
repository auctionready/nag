import { eq } from "drizzle-orm";
import { goal } from "@nag/schema";
import type { AnyDb } from "../../db";
import { lookupHabitId } from "./shared";

export type HabitGoalClearedPayload = { habitId: string };

export const applyHabitGoalCleared = async (
  db: AnyDb,
  payload: HabitGoalClearedPayload,
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;
  await db.delete(goal).where(eq(goal.habitId, habitId));
};
