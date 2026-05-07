import type { AnyDb } from "../../db";
import {
  lookupHabitId,
  writeGoalAndSchedules,
  type ServerGoal,
} from "./shared";

export type HabitGoalDefinedPayload = ServerGoal & { habitId: string };

export type HabitGoalDefinedResult = {
  scheduleIds: number[];
};

export const applyHabitGoalDefined = async (
  db: AnyDb,
  payload: HabitGoalDefinedPayload,
): Promise<HabitGoalDefinedResult> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return { scheduleIds: [] };
  return writeGoalAndSchedules(db, habitId, {
    regularity: payload.regularity,
    frequency: payload.frequency,
    schedules: payload.schedules,
  });
};
