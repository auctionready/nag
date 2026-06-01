import type { AnyDb } from "../../db";
import type { UnarchiveHabit } from "../schemas";
import type { HabitUnarchived } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Unarchives a habit (clearing both flags). Emits nothing if it isn't
 * archived.
 */
export const handleUnarchiveHabit = async (
  db: AnyDb,
  { habitId }: UnarchiveHabit,
): Promise<{ events: HabitUnarchived[] }> => {
  const { archived } = await loadHabitFlags(db, habitId);
  if (!archived) return { events: [] };
  return { events: [{ type: "HabitUnarchived", habitId }] };
};
