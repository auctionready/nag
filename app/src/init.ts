import { setNotificationScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./ExpoNotificationScheduler";

export const init = () => {
  setNotificationScheduler(expoNotificationScheduler);
};
