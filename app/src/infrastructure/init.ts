import * as Sentry from "@sentry/react-native";
import { setNotificationScheduler, setConsolidatedScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { log } from "./log";

const logger = log("init");

/**
 * `crypto.randomUUID()` is used by drizzle `$defaultFn`s on `habit`,
 * `check_in`, and `audit_log` for external identifiers. RN ≥ 0.76 on
 * Hermes supports it natively; log its presence at startup so a missing
 * global is obvious in logs rather than a silent insert-throw later.
 */
const ensureRandomUUID = () => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    try {
      const sample = g.crypto.randomUUID();
      logger.info(`crypto.randomUUID available (sample=${sample})`);
    } catch (e) {
      logger.error("crypto.randomUUID threw when sampled", e);
    }
    return;
  }
  logger.error(
    "crypto.randomUUID is NOT available — inserts into habit/check_in/audit_log will throw. " +
      "Install a polyfill or upgrade the runtime.",
  );
};

export const init = () => {
  logger.info("app init");
  Sentry.startSpan({ name: "init", op: "app.init" }, () => {
    setNotificationScheduler(expoNotificationScheduler);
    setConsolidatedScheduler(expoConsolidatedScheduler);
    ensureRandomUUID();
  });
};
