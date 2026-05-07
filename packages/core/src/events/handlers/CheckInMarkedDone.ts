import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";

export type CheckInMarkedDonePayload = { checkInId: string };

export const applyCheckInMarkedDone = async (
  db: AnyDb,
  payload: CheckInMarkedDonePayload,
): Promise<void> => {
  await db
    .update(checkIn)
    .set({ skipped: false, updatedAt: new Date() })
    .where(eq(checkIn.externalId, payload.checkInId));
};
