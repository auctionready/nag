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
  // Fire-and-forget: registers this device on first launch and re-tries on
  // every subsequent launch until the server returns an accountId. The
  // outbox dispatcher refuses to ship until that happens, so a failure here
  // holds up sync but never blocks app startup or the UI.
  void ensureDeviceRegistered({
    db,
    tokenStore: deviceTokenStore,
    register: registerDevice,
    log: identityLogger,
  }).catch((error) => {
    identityLogger.error("ensureDeviceRegistered threw unexpectedly", error);
  });
};
