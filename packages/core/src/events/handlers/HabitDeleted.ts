import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

export type HabitDeletedPayload = { habitId: string };

export const applyHabitDeleted = async (
  db: AnyDb,
  payload: HabitDeletedPayload,
): Promise<void> => {
  await db.delete(habit).where(eq(habit.externalId, payload.habitId));
};
