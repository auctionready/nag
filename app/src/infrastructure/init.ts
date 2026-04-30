import * as Sentry from "@sentry/react-native";
import {
  setNotificationScheduler,
  setConsolidatedScheduler,
  ensureDeviceRegistered,
} from "@nag/core";
import { db } from "../db";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { installCryptoPolyfill } from "./cryptoPolyfill";
import { installGlobalErrorHandlers } from "./globalErrorHandlers";
import { registerDevice } from "./apiClient";
import { deviceTokenStore } from "./tokenStore";
import { log } from "./log";

const logger = log("init");
const identityLogger = log("identity");

export const init = () => {
  logger.info("app init");
  // Polyfill first — subsequent code (including drizzle schema $defaultFn
  // callbacks for external/envelope IDs and our own device id generation)
  // depends on `crypto.randomUUID`.
  installCryptoPolyfill();
  installGlobalErrorHandlers();
  Sentry.startSpan({ name: "init", op: "app.init" }, () => {
    setNotificationScheduler(expoNotificationScheduler);
    setConsolidatedScheduler(expoConsolidatedScheduler);
  });
};

// Must be called after migrations have run — identity table is created by the
// initial migration and won't exist if this fires before DatabaseProvider is ready.
export const postMigrationInit = () => {
  void ensureDeviceRegistered({
    db,
    tokenStore: deviceTokenStore,
    register: registerDevice,
    log: identityLogger,
  }).catch((error) => {
    identityLogger.error("ensureDeviceRegistered threw unexpectedly", error);
  });
};
