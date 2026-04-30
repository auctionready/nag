import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateCheckIn } from "../schemas";
import type { CheckInRecorded } from "../../events";

export type CreateCheckInResult = {
  checkInId: number;
  externalId: string;
  events: [CheckInRecorded];
};

export async function handleCreateCheckIn(
  db: AnyDb,
  command: CreateCheckIn,
): Promise<CreateCheckInResult> {
  const [habitRow] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, command.habitId));
  if (!habitRow) {
    throw new Error(`CreateCheckIn: habit id=${command.habitId} not found`);
  }

  const [inserted] = await db
    .insert(checkIn)
    .values({
      habitId: command.habitId,
      // `timestamp` is the deemed slot time; `createdAt` is set by
      // `$defaultFn` to the wall-clock time of this insert.
      timestamp: command.timestamp,
      skipped: command.skipped ?? false,
    })
    .returning({ id: checkIn.id, externalId: checkIn.externalId });

  return {
    checkInId: inserted.id,
    externalId: inserted.externalId,
    events: [
      {
        type: "CheckInRecorded",
        checkInId: inserted.externalId,
        habitId: habitRow.externalId,
        timestamp: command.timestamp,
        skipped: command.skipped ?? false,
      },
    ],
  };
}
