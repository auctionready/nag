import * as Sentry from "@sentry/react-native";
import { setNotificationScheduler, setConsolidatedScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { installCryptoPolyfill } from "./cryptoPolyfill";
import { installGlobalErrorHandlers } from "./globalErrorHandlers";
import { log } from "./log";

const logger = log("init");

export const init = () => {
  logger.info("app init");
  // Polyfill first — subsequent code (including drizzle schema $defaultFn
  // callbacks for external/envelope IDs) depends on `crypto.randomUUID`.
  installCryptoPolyfill();
  installGlobalErrorHandlers();
  Sentry.startSpan({ name: "init", op: "app.init" }, () => {
    setNotificationScheduler(expoNotificationScheduler);
    setConsolidatedScheduler(expoConsolidatedScheduler);
  });
};
