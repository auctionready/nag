import { setNotificationScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";

export const init = () => {
  setNotificationScheduler(expoNotificationScheduler);
};
