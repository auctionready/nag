import * as Sentry from "@sentry/react-native";
import { setNotificationScheduler, setConsolidatedScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { installGlobalErrorHandlers } from "./globalErrorHandlers";
import { log } from "./log";

const logger = log("init");

export const init = () => {
  logger.info("app init");
  installGlobalErrorHandlers();
  Sentry.startSpan({ name: "init", op: "app.init" }, () => {
    setNotificationScheduler(expoNotificationScheduler);
    setConsolidatedScheduler(expoConsolidatedScheduler);
  });
};
