import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitPausedPayload = { habitId: string };

export const applyHabitPaused = async (
  db: AnyDb,
  payload: HabitPausedPayload,
): Promise<void> => {
  await db
    .update(habit)
    .set({ pausedAt: new Date(), updatedAt: new Date() })
    .where(eq(habit.id, payload.habitId));
};
