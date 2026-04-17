import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import { syncAllNotifications } from "../../notificationConsolidator";
import type { UpdateCheckIn } from "../schemas";

export async function handleUpdateCheckIn(
  db: AnyDb,
  command: UpdateCheckIn,
): Promise<Record<string, never>> {
  await db
    .update(checkIn)
    .set({
      timestamp: command.timestamp,
      ...(command.skipped !== undefined && { skipped: command.skipped }),
      updatedAt: new Date(),
    })
    .where(eq(checkIn.id, command.checkInId));
  await syncAllNotifications(db);
  return {};
}
