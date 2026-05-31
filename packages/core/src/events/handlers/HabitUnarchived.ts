import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitUnarchivedPayload = { habitId: string };

/**
 * Unarchiving returns a habit to the fully-active state: it clears
 * `archivedAt` *and* `pausedAt`, so an archived-then-unarchived habit is
 * active, never paused.
 */
export const applyHabitUnarchived = async (
  db: AnyDb,
  payload: HabitUnarchivedPayload,
): Promise<void> => {
  await db
    .update(habit)
    .set({ archivedAt: null, pausedAt: null, updatedAt: new Date() })
    .where(eq(habit.id, payload.habitId));
};
