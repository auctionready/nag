import type { AnyDb } from "../../db";
import { writeGoalAndSchedules, type ServerGoal } from "./shared";

export type HabitGoalDefinedPayload = ServerGoal & { habitId: string };

export const applyHabitGoalDefined = async (
  db: AnyDb,
  payload: HabitGoalDefinedPayload,
): Promise<void> => {
  await writeGoalAndSchedules(db, payload.habitId, {
    regularity: payload.regularity,
    frequency: payload.frequency,
    schedules: payload.schedules,
  });
};
