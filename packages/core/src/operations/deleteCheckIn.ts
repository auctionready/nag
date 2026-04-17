import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import { syncAllNotifications } from "../notificationConsolidator";

export const deleteCheckIn = async (db: AnyDb, checkInId: number) => {
  await processCommand(db, {
    type: "DeleteCheckIn",
    checkInId,
  });

  await syncAllNotifications(db);
};
