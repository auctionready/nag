import type { AnyDb } from "../../db";
import type { ArchiveHabit } from "../schemas";
import type { HabitArchived } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Archive valid iff the habit is not already archived (it may be active
 * or paused). Archiving a paused habit is allowed and keeps it out of
 * the schedule it was already out of.
 */
export const handleArchiveHabit = async (
  db: AnyDb,
  { habitId }: ArchiveHabit,
): Promise<{ events: [HabitArchived] }> => {
  const { archived } = await loadHabitFlags(db, habitId);
  if (archived) {
    throw new Error(`ArchiveHabit: habit id=${habitId} is already archived`);
  }
  return { events: [{ type: "HabitArchived", habitId }] };
};
