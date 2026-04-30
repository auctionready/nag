import { eq } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateCheckIn } from "../schemas";
import type {
  CheckInMarkedDone,
  CheckInMarkedSkipped,
  CheckInMoved,
} from "../../events";

type Event = CheckInMoved | CheckInMarkedSkipped | CheckInMarkedDone;

export type UpdateCheckInResult = {
  events: Event[];
};

export async function handleUpdateCheckIn(
  db: AnyDb,
  command: UpdateCheckIn,
): Promise<UpdateCheckInResult> {
  // Read the current row so we can build the precise events. We need
  // both external ids (for the wire) and the prior timestamp / skipped
  // state to decide whether the move and skip-toggle events are needed.
  const [row] = await db
    .select({
      externalId: checkIn.externalId,
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
      skipped: checkIn.skipped,
    })
    .from(checkIn)
    .where(eq(checkIn.id, command.checkInId));
  if (!row) {
    throw new Error(
      `UpdateCheckIn: check-in id=${command.checkInId} not found`,
    );
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

  await db
    .update(checkIn)
    .set({
      timestamp: command.timestamp,
      ...(command.skipped !== undefined && { skipped: command.skipped }),
      updatedAt: new Date(),
    })
    .where(eq(checkIn.id, command.checkInId));

  const events: Event[] = [];

  if (row.timestamp.getTime() !== command.timestamp.getTime()) {
    const moved: CheckInMoved = {
      type: "CheckInMoved",
      checkInId: row.externalId,
      habitId: habitRow.externalId,
      oldTimestamp: row.timestamp,
      newTimestamp: command.timestamp,
    };
    events.push(moved);
  }

  if (command.skipped !== undefined && command.skipped !== row.skipped) {
    const skipEvent: CheckInMarkedSkipped | CheckInMarkedDone = {
      type: command.skipped ? "CheckInMarkedSkipped" : "CheckInMarkedDone",
      checkInId: row.externalId,
      habitId: habitRow.externalId,
      timestamp: command.timestamp,
    };
    events.push(skipEvent);
  }

  return { events };
}
