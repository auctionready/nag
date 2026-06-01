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
 * - Paused habits stop accruing from the moment they were paused: a
 *   check-in is only allowed if its deemed `timestamp` predates
 *   `pausedAt` (you can back-fill earlier slots, but not log anything
 *   from the pause onward).
 *
 * The UI keeps within these bounds (archived is read-only; the paused
 * back-fill picker is capped at `pausedAt`); the checks here are the
 * authoritative guard.
 */
export const handleCreateCheckIn = async (
  db: AnyDb,
  { checkInId, habitId, timestamp, skipped }: CreateCheckIn,
): Promise<{ events: [CheckInRecorded] }> => {
  const [parent] = await db
    .select({ archivedAt: habit.archivedAt, pausedAt: habit.pausedAt })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!parent) {
    throw new Error(`CreateCheckIn: habit id=${habitId} not found`);
  }
  if (parent.archivedAt != null) {
    throw new Error(`CreateCheckIn: habit id=${habitId} is archived`);
  }
  if (parent.pausedAt != null && timestamp >= parent.pausedAt) {
    throw new Error(
      `CreateCheckIn: habit id=${habitId} is paused; only check-ins before the pause are allowed`,
    );
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
