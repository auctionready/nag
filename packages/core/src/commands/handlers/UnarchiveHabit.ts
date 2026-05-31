import type { AnyDb } from "../../db";
import type { UnarchiveHabit } from "../schemas";
import type { HabitUnarchived } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Unarchive valid iff the habit is archived. The event clears both
 * flags, returning the habit to the active state.
 */
export const handleUnarchiveHabit = async (
  db: AnyDb,
  { habitId }: UnarchiveHabit,
): Promise<{ events: [HabitUnarchived] }> => {
  const { archived } = await loadHabitFlags(db, habitId);
  if (!archived) {
    throw new Error(`UnarchiveHabit: habit id=${habitId} is not archived`);
  }
  return { events: [{ type: "HabitUnarchived", habitId }] };
};
