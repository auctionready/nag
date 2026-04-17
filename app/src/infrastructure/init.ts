import {
  setConsolidatedScheduler,
  setNotificationScheduler,
  setPostCommandInterceptor,
  syncAllNotifications,
} from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";

const SYNC_TRIGGERS = new Set([
  "CreateHabit",
  "UpdateHabit",
  "DeleteHabit",
  "CreateCheckIn",
  "UpdateCheckIn",
  "DeleteCheckIn",
]);

export const init = () => {
  setNotificationScheduler(expoNotificationScheduler);
  setConsolidatedScheduler(expoConsolidatedScheduler);
  setPostCommandInterceptor(async (db, command) => {
    if (SYNC_TRIGGERS.has(command.type)) {
      await syncAllNotifications(db);
    }
  });
};
