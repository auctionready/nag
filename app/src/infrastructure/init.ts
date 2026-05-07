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

/**
 * Hook for any work that must wait until the local SQLite migrations
 * have finished. Today there's nothing — device registration used to
 * live here, but moved into the Clerk sign-in effect now that
 * anonymous mode means "no server contact at all". Kept as a stable
 * extension point so callers in `_layout.tsx` don't need to change
 * shape if startup work returns.
 */
export const postMigrationInit = () => {
  // intentionally empty — see docstring.
};
