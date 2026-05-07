import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import { lookupCheckInId, lookupHabitId } from "./shared";

export type CheckInRecordedPayload = {
  checkInId: string;
  habitId: string;
  timestamp: string;
  skipped?: boolean | null;
};

export type CheckInRecordedResult = {
  checkInId: number | null;
};

export const applyCheckInRecorded = async (
  db: AnyDb,
  payload: CheckInRecordedPayload,
): Promise<CheckInRecordedResult> => {
  const habitId = await lookupHabitId(db, payload.habitId);
  if (habitId === null) return { checkInId: null };
  await db
    .insert(checkIn)
    .values({
      externalId: payload.checkInId,
      habitId,
      timestamp: new Date(payload.timestamp),
      skipped: payload.skipped ?? false,
    })
    .onConflictDoUpdate({
      target: checkIn.externalId,
      set: {
        habitId,
        timestamp: new Date(payload.timestamp),
        skipped: payload.skipped ?? false,
        updatedAt: new Date(),
      },
    });
  const checkInId = await lookupCheckInId(db, payload.checkInId);
  return { checkInId };
};
