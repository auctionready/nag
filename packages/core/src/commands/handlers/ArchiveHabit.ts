import type { AnyDb } from "../../db";
import type { ArchiveHabit } from "../schemas";
import type { HabitArchived } from "../../events";

export const handleArchiveHabit = async (
  _db: AnyDb,
  { habitId }: ArchiveHabit,
): Promise<{ events: [HabitArchived] }> => {
  return { events: [{ type: "HabitArchived", habitId }] };
};
