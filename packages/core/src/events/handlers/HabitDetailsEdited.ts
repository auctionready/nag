import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import { lookupHabitId } from "./shared";

export type HabitDetailsEditedPayload = {
  habitId: string;
  title?: string | null;
  description?: string | null;
  clearDescription?: boolean;
  icon?: string | null;
  clearIcon?: boolean;
};

export const applyHabitDetailsEdited = async (
  db: AnyDb,
  payload: HabitDetailsEditedPayload,
): Promise<void> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.title != null) set.title = payload.title;
  if (payload.clearDescription) set.description = null;
  else if (payload.description != null) set.description = payload.description;
  if (payload.clearIcon) set.icon = null;
  else if (payload.icon != null) set.icon = payload.icon;
  await db.update(habit).set(set).where(eq(habit.id, habitId));
};
