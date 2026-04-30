import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteCheckIn } from "../schemas";
import type { CheckInDeleted } from "../../events";

export type DeleteCheckInResult = {
  externalId: string;
  events: [CheckInDeleted];
};

export async function handleDeleteCheckIn(
  db: AnyDb,
  command: DeleteCheckIn,
): Promise<DeleteCheckInResult> {
  const [row] = await db
    .select({
      externalId: checkIn.externalId,
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
    })
    .from(checkIn)
    .where(eq(checkIn.id, command.checkInId));
  if (!row) {
    throw new Error(
      `DeleteCheckIn: check-in id=${command.checkInId} not found`,
    );
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

  await db.delete(checkIn).where(eq(checkIn.id, command.checkInId));

  return {
    externalId: row.externalId,
    events: [
      {
        type: "CheckInDeleted",
        checkInId: row.externalId,
        habitId: habitRow.externalId,
        timestamp: row.timestamp,
      },
    ],
  };
}
