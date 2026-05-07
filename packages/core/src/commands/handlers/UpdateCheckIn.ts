import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
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

export type UpdateCheckInResult = {
  events: UpdateCheckInEvent[];
};

export type UpdateCheckInOutput = {
  events: UpdateCheckInEvent[];
  finalize: (applied: unknown[]) => UpdateCheckInResult;
};

export const handleUpdateCheckIn = async (
  db: AnyDb,
  { checkInId, timestamp: newTimestamp, skipped: newSkipped }: UpdateCheckIn,
): Promise<UpdateCheckInOutput> => {
  const [row] = await db
    .select({
      externalId: checkIn.externalId,
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
      skipped: checkIn.skipped,
    })
    .from(checkIn)
    .where(eq(checkIn.id, checkInId));
  if (!row) {
    throw new Error(`UpdateCheckIn: check-in id=${checkInId} not found`);
  }

  const [habitRow] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, row.habitId));
  if (!habitRow) {
    throw new Error(
      `UpdateCheckIn: habit id=${row.habitId} for check-in not found`,
    );
  }

  const events: UpdateCheckInEvent[] = [];

  if (row.timestamp.getTime() !== newTimestamp.getTime()) {
    events.push({
      type: "CheckInMoved",
      checkInId: row.externalId,
      habitId: habitRow.externalId,
      oldTimestamp: row.timestamp,
      newTimestamp,
    });
  }

  if (newSkipped !== undefined && newSkipped !== row.skipped) {
    events.push({
      type: newSkipped ? "CheckInMarkedSkipped" : "CheckInMarkedDone",
      checkInId: row.externalId,
      habitId: habitRow.externalId,
      timestamp: newTimestamp,
    });
  }

  return { events, finalize: () => ({ events }) };
};
