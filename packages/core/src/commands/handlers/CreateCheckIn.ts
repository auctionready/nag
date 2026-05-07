import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateCheckIn } from "../schemas";
import type { CheckInRecorded } from "../../events";
import type { CheckInRecordedResult } from "../../events/handlers/CheckInRecorded";

export type CreateCheckInResult = {
  checkInId: number;
  externalId: string;
  events: [CheckInRecorded];
};

export type CreateCheckInOutput = {
  events: [CheckInRecorded];
  finalize: (applied: unknown[]) => CreateCheckInResult;
};

export const handleCreateCheckIn = async (
  db: AnyDb,
  { habitId, timestamp, skipped }: CreateCheckIn,
): Promise<CreateCheckInOutput> => {
  const [habitRow] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!habitRow) {
    throw new Error(`CreateCheckIn: habit id=${habitId} not found`);
  }

  const externalId = crypto.randomUUID();
  const event: CheckInRecorded = {
    type: "CheckInRecorded",
    checkInId: externalId,
    habitId: habitRow.externalId,
    timestamp,
    skipped: skipped ?? false,
  };

  return {
    events: [event],
    finalize: (applied) => {
      const r = applied[0] as CheckInRecordedResult;
      if (r.checkInId == null) {
        throw new Error(
          "CreateCheckIn: CheckInRecorded apply did not return checkInId",
        );
      }
      return { checkInId: r.checkInId, externalId, events: [event] };
    },
  };
};
