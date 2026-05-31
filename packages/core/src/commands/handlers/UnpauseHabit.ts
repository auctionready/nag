import type { AnyDb } from "../../db";
import type { UnpauseHabit } from "../schemas";
import type { HabitUnpaused } from "../../events";

export const handleUnpauseHabit = async (
  _db: AnyDb,
  { habitId }: UnpauseHabit,
): Promise<{ events: [HabitUnpaused] }> => {
  return { events: [{ type: "HabitUnpaused", habitId }] };
};
