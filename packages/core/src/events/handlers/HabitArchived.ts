import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitArchivedPayload = { habitId: string };

export const applyHabitArchived = async (
  db: AnyDb,
  payload: HabitArchivedPayload,
): Promise<void> => {
  await db
    .update(habit)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(habit.id, payload.habitId));
};
