import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

/**
 * Current lifecycle flags of a habit, read by the archive/pause command
 * handlers so they only emit an event for a valid transition (e.g. don't
 * re-archive an already-archived habit). A missing habit reads as
 * neither archived nor paused.
 */
export type HabitFlags = { archived: boolean; paused: boolean };

export const loadHabitFlags = async (
  db: AnyDb,
  habitId: string,
): Promise<HabitFlags> => {
  const [row] = await db
    .select({ archivedAt: habit.archivedAt, pausedAt: habit.pausedAt })
    .from(habit)
    .where(eq(habit.id, habitId));
  return { archived: row?.archivedAt != null, paused: row?.pausedAt != null };
};
