import type { AnyDb } from "../../db";
import type { UnpauseHabit } from "../schemas";
import type { HabitUnpaused } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Unpauses a habit. Emits nothing unless it's currently paused (and not
 * archived).
 */
export const handleUnpauseHabit = async (
  db: AnyDb,
  { habitId }: UnpauseHabit,
): Promise<{ events: HabitUnpaused[] }> => {
  const { archived, paused } = await loadHabitFlags(db, habitId);
  if (archived || !paused) return { events: [] };
  return { events: [{ type: "HabitUnpaused", habitId }] };
};
