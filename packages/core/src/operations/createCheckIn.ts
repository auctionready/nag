import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import { syncAllNotifications } from "../notificationConsolidator";

interface CreateCheckInInput {
  habitId: number;
  timestamp: Date;
  skipped?: boolean;
}

export const createCheckIn = async (db: AnyDb, input: CreateCheckInInput) => {
  const result = await processCommand(db, {
    type: "CreateCheckIn",
    habitId: input.habitId,
    timestamp: input.timestamp,
    skipped: input.skipped,
  });

  await syncAllNotifications(db);

  return result;
};
