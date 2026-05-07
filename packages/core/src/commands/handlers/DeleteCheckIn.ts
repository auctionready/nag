import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteCheckIn } from "../schemas";
import type { CheckInDeleted } from "../../events";

export type DeleteCheckInResult = {
  externalId: string;
  events: [CheckInDeleted];
};

export type DeleteCheckInOutput = {
  events: [CheckInDeleted];
  finalize: (applied: unknown[]) => DeleteCheckInResult;
};

export const handleDeleteCheckIn = async (
  db: AnyDb,
  { checkInId }: DeleteCheckIn,
): Promise<DeleteCheckInOutput> => {
  const [row] = await db
    .select({
      externalId: checkIn.externalId,
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
    })
    .from(checkIn)
    .where(eq(checkIn.id, checkInId));
  if (!row) {
    throw new Error(`DeleteCheckIn: check-in id=${checkInId} not found`);
  }
  const [habitRow] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, row.habitId));
  if (!habitRow) {
    throw new Error(
      `DeleteCheckIn: habit id=${row.habitId} for check-in not found`,
    );
  }

  const { externalId } = row;
  const event: CheckInDeleted = {
    type: "CheckInDeleted",
    checkInId: externalId,
    habitId: habitRow.externalId,
    timestamp: row.timestamp,
  };

  return {
    events: [event],
    finalize: () => ({ externalId, events: [event] }),
  };
};
