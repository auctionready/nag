import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateCheckIn } from "../schemas";
import type {
  CheckInMarkedDone,
  CheckInMarkedSkipped,
  CheckInMoved,
} from "../../events";

type UpdateCheckInEvent =
  | CheckInMoved
  | CheckInMarkedSkipped
  | CheckInMarkedDone;

/**
 * Reads the existing check-in to diff against the requested update — we
 * only emit events for fields that actually changed. The wire-level
 * events still carry `habitId`, the old/current `timestamp`, etc., so
 * backend projections can resolve provenance without rewalking.
 */
export const handleUpdateCheckIn = async (
  db: AnyDb,
  { checkInId, timestamp: newTimestamp, skipped: newSkipped }: UpdateCheckIn,
): Promise<{ events: UpdateCheckInEvent[] }> => {
  const [row] = await db
    .select({
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
      skipped: checkIn.skipped,
    })
    .from(checkIn)
    .where(eq(checkIn.id, checkInId));
  if (!row) {
    throw new Error(`UpdateCheckIn: check-in id=${checkInId} not found`);
  }

  const events: UpdateCheckInEvent[] = [];

  if (row.timestamp.getTime() !== newTimestamp.getTime()) {
    events.push({
      type: "CheckInMoved",
      checkInId,
      habitId: row.habitId,
      oldTimestamp: row.timestamp,
      newTimestamp,
    });
  }

  if (newSkipped !== undefined && newSkipped !== row.skipped) {
    events.push({
      type: newSkipped ? "CheckInMarkedSkipped" : "CheckInMarkedDone",
      checkInId,
      habitId: row.habitId,
      timestamp: newTimestamp,
    });
  }

  return { events };
};
