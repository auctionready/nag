import type { AnyDb } from "../../db";
import type { PauseHabit } from "../schemas";
import type { HabitPaused } from "../../events";

export const handlePauseHabit = async (
  _db: AnyDb,
  { habitId }: PauseHabit,
): Promise<{ events: [HabitPaused] }> => {
  return { events: [{ type: "HabitPaused", habitId }] };
};
