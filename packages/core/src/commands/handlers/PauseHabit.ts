import type { AnyDb } from "../../db";
import type { PauseHabit } from "../schemas";
import type { HabitPaused } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Pauses a habit. Emits nothing if it's archived (pause is unavailable
 * while archived) or already paused.
 */
export const handlePauseHabit = async (
  db: AnyDb,
  { habitId }: PauseHabit,
): Promise<{ events: HabitPaused[] }> => {
  const { archived, paused } = await loadHabitFlags(db, habitId);
  if (archived || paused) return { events: [] };
  return { events: [{ type: "HabitPaused", habitId }] };
};
