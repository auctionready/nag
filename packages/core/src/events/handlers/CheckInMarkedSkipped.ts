import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";

export type CheckInMarkedSkippedPayload = { checkInId: string };

export const applyCheckInMarkedSkipped = async (
  db: AnyDb,
  payload: CheckInMarkedSkippedPayload,
): Promise<void> => {
  await db
    .update(checkIn)
    .set({ skipped: true, updatedAt: new Date() })
    .where(eq(checkIn.id, payload.checkInId));
};
