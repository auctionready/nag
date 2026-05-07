import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";

export type CheckInDeletedPayload = { checkInId: string };

export const applyCheckInDeleted = async (
  db: AnyDb,
  payload: CheckInDeletedPayload,
): Promise<void> => {
  await db.delete(checkIn).where(eq(checkIn.externalId, payload.checkInId));
};
