import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import { getNotificationScheduler } from "../notifications";

export const deleteHabit = async (db: AnyDb, habitId: number) => {
  await getNotificationScheduler().cancelNotifications(habitId);
  await processCommand(db, { type: "DeleteHabit", habitId });
};
