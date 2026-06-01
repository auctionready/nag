import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateCheckIn } from "../schemas";
import type { CheckInRecorded } from "../../events";

/**
 * Validates the target habit before emitting the event so a stray local
 * command can't leave a no-op event in the outbox. The apply path itself
 * is tolerant of a missing parent (sync replay can arrive out of order);
 * only the user-driven local command needs the up-front check.
 *
 * Lifecycle rules:
 * - Archived habits are read-only — no check-ins or skips at all.
 * - Paused habits can still be logged manually (the detail footer's
 *   check-in / skip always works); pausing only stops the nags and demotes
 *   the habit. The scheduled time-slot pills are back-fill-gated to slots
 *   up to `pausedAt` in the UI, but that's a presentation nicety — not
 *   enforced here.
 */
export const handleCreateCheckIn = async (
  db: AnyDb,
  { checkInId, habitId, timestamp, skipped }: CreateCheckIn,
): Promise<{ events: [CheckInRecorded] }> => {
  const [parent] = await db
    .select({ archivedAt: habit.archivedAt })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!parent) {
    throw new Error(`CreateCheckIn: habit id=${habitId} not found`);
  }
  if (parent.archivedAt != null) {
    throw new Error(`CreateCheckIn: habit id=${habitId} is archived`);
  }

  const event: CheckInRecorded = {
    type: "CheckInRecorded",
    checkInId,
    habitId,
    timestamp,
    skipped: skipped ?? false,
  };
  return { events: [event] };
};
