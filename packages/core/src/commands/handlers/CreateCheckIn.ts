import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateCheckIn } from "../schemas";
import type { CheckInRecorded } from "../../events";

/**
 * Validates the target habit exists before emitting the event so a
 * stray local command can't leave a no-op event in the outbox. The
 * apply path itself is tolerant of a missing parent (sync replay can
 * arrive out of order); only the user-driven local command needs the
 * up-front check.
 *
 * A paused or archived habit cannot be checked in or skipped — both
 * states take the habit out of active tracking — so the command is
 * rejected here, the single point every check-in/skip path routes
 * through.
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
  if (parent.pausedAt != null) {
    throw new Error(`CreateCheckIn: habit id=${habitId} is paused`);
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
