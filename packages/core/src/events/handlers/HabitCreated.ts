import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import {
  lookupHabitId,
  writeGoalAndSchedules,
  type ServerGoal,
} from "./shared";

export type HabitCreatedPayload = {
  habitId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  goal?: ServerGoal | null;
};

export type HabitCreatedResult = {
  habitId: number | null;
  scheduleIds: number[];
};

export const applyHabitCreated = async (
  db: AnyDb,
  payload: HabitCreatedPayload,
): Promise<HabitCreatedResult> => {
  // Upsert keyed on external_id so a replay of an already-applied
  // event (e.g. our own command echoed back as an event, or a redelivery
  // on resume) is a no-op rather than a constraint violation.
  await db
    .insert(habit)
    .values({
      externalId: payload.habitId,
      title: payload.title,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
    })
    .onConflictDoUpdate({
      target: habit.externalId,
      set: {
        title: payload.title,
        description: payload.description ?? null,
        icon: payload.icon ?? null,
        updatedAt: new Date(),
      },
    });

  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return { habitId: null, scheduleIds: [] };
  if (!payload.goal) return { habitId, scheduleIds: [] };
  const { scheduleIds } = await writeGoalAndSchedules(
    db,
    habitId,
    payload.goal,
  );
  return { habitId, scheduleIds };
};
