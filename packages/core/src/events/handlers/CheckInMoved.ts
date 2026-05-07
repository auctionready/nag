import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";

export type CheckInMovedPayload = {
  checkInId: string;
  newTimestamp: string;
};

export const applyCheckInMoved = async (
  db: AnyDb,
  payload: CheckInMovedPayload,
): Promise<void> => {
  // No-op if the row is missing locally — the original CreateCheckIn may
  // not have replayed yet, or the row was deleted by a later event.
  await db
    .update(checkIn)
    .set({
      timestamp: new Date(payload.newTimestamp),
      updatedAt: new Date(),
    })
    .where(eq(checkIn.externalId, payload.checkInId));
};
