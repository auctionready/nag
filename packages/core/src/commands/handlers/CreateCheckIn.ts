import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import { syncAllNotifications } from "../../notificationConsolidator";
import type { CreateCheckIn } from "../schemas";

export async function handleCreateCheckIn(
  db: AnyDb,
  command: CreateCheckIn,
): Promise<{ checkInId: number; externalId: string }> {
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

  await syncAllNotifications(db);
  return { checkInId: inserted.id, externalId: inserted.externalId };
}
