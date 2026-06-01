import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitUnpausedPayload = { habitId: string };

export const applyHabitUnpaused = async (
  db: AnyDb,
  payload: HabitUnpausedPayload,
): Promise<void> => {
  await db
    .update(habit)
    .set({ pausedAt: null, updatedAt: new Date() })
    .where(eq(habit.id, payload.habitId));
};
