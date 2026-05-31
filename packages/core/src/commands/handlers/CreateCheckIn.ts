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
 * Paused and archived habits can't be checked in or skipped, but that's
 * prevented in the UI (their check-in affordances are hidden and they
 * carry no schedule slots) rather than guarded here.
 */
export const handleCreateCheckIn = async (
  db: AnyDb,
  { checkInId, habitId, timestamp, skipped }: CreateCheckIn,
): Promise<{ events: [CheckInRecorded] }> => {
  const [parent] = await db
    .select({ id: habit.id })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!parent) {
    throw new Error(`CreateCheckIn: habit id=${habitId} not found`);
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
