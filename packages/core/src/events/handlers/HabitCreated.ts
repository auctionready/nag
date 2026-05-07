import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import { writeGoalAndSchedules, type ServerGoal } from "./shared";

export type HabitCreatedPayload = {
  habitId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  goal?: ServerGoal | null;
};

export const applyHabitCreated = async (
  db: AnyDb,
  payload: HabitCreatedPayload,
): Promise<void> => {
  // Upsert keyed on id so a replay of an already-applied event (e.g. our
  // own command echoed back as an event, or a redelivery on resume) is a
  // no-op rather than a constraint violation.
  await db
    .insert(habit)
    .values({
      id: payload.habitId,
      title: payload.title,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
    })
    .onConflictDoUpdate({
      target: habit.id,
      set: {
        title: payload.title,
        description: payload.description ?? null,
        icon: payload.icon ?? null,
        updatedAt: new Date(),
      },
    });

  if (payload.goal) {
    await writeGoalAndSchedules(db, payload.habitId, payload.goal);
  }
};
