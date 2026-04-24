import { eq } from "drizzle-orm";
import { checkIn } from "@nag/schema";
import type { AnyDb } from "../../db";
import { syncAllNotifications } from "../../notificationConsolidator";
import type { DeleteCheckIn } from "../schemas";

export async function handleDeleteCheckIn(
  db: AnyDb,
  command: DeleteCheckIn,
): Promise<{ externalId: string }> {
  const deleted = await db
    .delete(checkIn)
    .where(eq(checkIn.id, command.checkInId))
    .returning({ externalId: checkIn.externalId });

  if (deleted.length === 0) {
    throw new Error(
      `DeleteCheckIn: check-in id=${command.checkInId} not found`,
    );
  }

  await syncAllNotifications(db);
  return { externalId: deleted[0].externalId };
}
