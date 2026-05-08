import { eq } from "drizzle-orm";
import { checkIn, goal, habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import { deleteSchedulesForHabit } from "./shared";

export type HabitDeletedPayload = { habitId: string };

export const applyHabitDeleted = async (
  db: AnyDb,
  payload: HabitDeletedPayload,
): Promise<void> => {
  // Delete children explicitly so the change listener fires for each
  // affected table — SQLite's update_hook is silent for FK cascades, and
  // useLiveQuery consumers keyed on `check_in`, `schedule`, or `goal`
  // would otherwise miss the deletion.
  await db.delete(checkIn).where(eq(checkIn.habitId, payload.habitId));
  await deleteSchedulesForHabit(db, payload.habitId);
  await db.delete(goal).where(eq(goal.habitId, payload.habitId));
  await db.delete(habit).where(eq(habit.id, payload.habitId));
};
