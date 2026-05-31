import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";

/**
 * Current lifecycle flags of a habit, read up-front by the
 * archive/pause command handlers so they can reject an invalid
 * transition before emitting an event. Mirrors the server-side
 * invariant check in `EventDispatcher`.
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
  if (!row) {
    throw new Error(`habit id=${habitId} not found`);
  }
  return { archived: row.archivedAt != null, paused: row.pausedAt != null };
};
