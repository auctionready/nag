import type { AnyDb } from "../../db";
import type { UnarchiveHabit } from "../schemas";
import type { HabitUnarchived } from "../../events";

export const handleUnarchiveHabit = async (
  _db: AnyDb,
  { habitId }: UnarchiveHabit,
): Promise<{ events: [HabitUnarchived] }> => {
  return { events: [{ type: "HabitUnarchived", habitId }] };
};
