import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import { syncAllNotifications } from "../notificationConsolidator";

export const deleteHabit = async (db: AnyDb, habitId: number) => {
  await processCommand(db, { type: "DeleteHabit", habitId });
  await syncAllNotifications(db);
};
