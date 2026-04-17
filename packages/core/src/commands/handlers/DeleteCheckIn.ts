import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import { syncAllNotifications } from "../../notificationConsolidator";
import type { DeleteCheckIn } from "../schemas";

export async function handleDeleteCheckIn(
  db: AnyDb,
  command: DeleteCheckIn,
): Promise<void> {
  await db.delete(checkIn).where(eq(checkIn.id, command.checkInId));
  await syncAllNotifications(db);
}
