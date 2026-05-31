import type { AnyDb } from "../../db";
import type { UnpauseHabit } from "../schemas";
import type { HabitUnpaused } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Unpause valid iff the habit is paused and not archived.
 */
export const handleUnpauseHabit = async (
  db: AnyDb,
  { habitId }: UnpauseHabit,
): Promise<{ events: [HabitUnpaused] }> => {
  const { archived, paused } = await loadHabitFlags(db, habitId);
  if (archived) {
    throw new Error(`UnpauseHabit: habit id=${habitId} is archived`);
  }
  if (!paused) {
    throw new Error(`UnpauseHabit: habit id=${habitId} is not paused`);
  }
  return { events: [{ type: "HabitUnpaused", habitId }] };
};
