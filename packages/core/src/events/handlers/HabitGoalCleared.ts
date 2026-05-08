import { eq } from "drizzle-orm";
import { goal } from "@nag/schema";
import type { AnyDb } from "../../db";
import { deleteSchedulesForHabit } from "./shared";

export type HabitGoalClearedPayload = { habitId: string };

export const applyHabitGoalCleared = async (
  db: AnyDb,
  payload: HabitGoalClearedPayload,
): Promise<void> => {
  // Delete schedules explicitly before the goal — SQLite's update_hook
  // doesn't fire for FK cascades, so live-query consumers wouldn't notice.
  await deleteSchedulesForHabit(db, payload.habitId);
  await db.delete(goal).where(eq(goal.habitId, payload.habitId));
};
