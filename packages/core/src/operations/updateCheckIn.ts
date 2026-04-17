import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import { syncAllNotifications } from "../notificationConsolidator";

interface UpdateCheckInInput {
  checkInId: number;
  timestamp: Date;
  skipped?: boolean;
}

export const updateCheckIn = async (db: AnyDb, input: UpdateCheckInInput) => {
  await processCommand(db, {
    type: "UpdateCheckIn",
    checkInId: input.checkInId,
    timestamp: input.timestamp,
    skipped: input.skipped,
  });

  await syncAllNotifications(db);
};
