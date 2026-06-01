import type { AnyDb } from "../../db";
import type { ArchiveHabit } from "../schemas";
import type { HabitArchived } from "../../events";
import { loadHabitFlags } from "./habitLifecycle";

/**
 * Archives a habit. Emits nothing if it's already archived, so the
 * command is idempotent and never produces a redundant event.
 */
export const handleArchiveHabit = async (
  db: AnyDb,
  { habitId }: ArchiveHabit,
): Promise<{ events: HabitArchived[] }> => {
  const { archived } = await loadHabitFlags(db, habitId);
  if (archived) return { events: [] };
  return { events: [{ type: "HabitArchived", habitId }] };
};
