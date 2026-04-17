import { setNotificationScheduler, setConsolidatedScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";

export const init = () => {
  setNotificationScheduler(expoNotificationScheduler);
  setConsolidatedScheduler(expoConsolidatedScheduler);
};
