import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteCheckIn } from "../schemas";
import type { CheckInDeleted } from "../../events";

/**
 * Reads the existing check-in to populate `habitId` and `timestamp` on
 * the wire event — backend projections need both to invalidate per-period
 * summaries. The check-in is identified by the caller-supplied UUID.
 */
export const handleDeleteCheckIn = async (
  db: AnyDb,
  { checkInId }: DeleteCheckIn,
): Promise<{ events: [CheckInDeleted] }> => {
  const [row] = await db
    .select({ habitId: checkIn.habitId, timestamp: checkIn.timestamp })
    .from(checkIn)
    .where(eq(checkIn.id, checkInId));
  if (!row) {
    throw new Error(`DeleteCheckIn: check-in id=${checkInId} not found`);
  }
  const event: CheckInDeleted = {
    type: "CheckInDeleted",
    checkInId,
    habitId: row.habitId,
    timestamp: row.timestamp,
  };
  return { events: [event] };
};
