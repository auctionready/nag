import type { AnyDb } from "../../db";
import type { PauseHabit } from "../schemas";
import type { HabitPaused } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Pause valid iff the habit is neither paused nor archived (an archived
 * habit has no pause toggle).
 */
export const handlePauseHabit = async (
  db: AnyDb,
  { habitId }: PauseHabit,
): Promise<{ events: [HabitPaused] }> => {
  const { archived, paused } = await loadHabitFlags(db, habitId);
  if (archived) {
    throw new Error(`PauseHabit: habit id=${habitId} is archived`);
  }
  if (paused) {
    throw new Error(`PauseHabit: habit id=${habitId} is already paused`);
  }
  return { events: [{ type: "HabitPaused", habitId }] };
};
