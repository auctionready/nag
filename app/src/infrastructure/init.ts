import * as Sentry from "@sentry/react-native";
import { setNotificationScheduler, setConsolidatedScheduler } from "@nag/core";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { installGlobalErrorHandlers } from "./globalErrorHandlers";
import { getAuthMode } from "./devOverrides";
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
 * have finished. In dev-auth mode (driven by `EXPO_PUBLIC_NAG_DEV_AUTH=1`
 * or the dev-menu backend override), this mints a token via the
 * backend's `/dev/token` so the app starts as the SwaggerDevAuth fake
 * user without a Clerk sign-in. In Clerk mode this is a no-op —
 * device registration still lives behind the post-Clerk-sign-in effect
 * in `account.tsx`.
 *
 * The dev-auth wiring is loaded via a `__DEV__`-guarded `require` so
 * Metro drops `initDevAuth.ts` (and its `fetchDevToken` /
 * `ensureDevAuthRegistered` imports) from production bundles. Keeping
 * `getAuthMode()` as the inner check means the dev-menu's runtime
 * "Switch backend → Cloud apidev" preset still works in dev clients.
 */
export const postMigrationInit = () => {
  if (!__DEV__) return;
  if (getAuthMode() !== "dev-auth") return;
  const { runDevAuthRegistration } =
    require("./initDevAuth") as typeof import("./initDevAuth");
  void runDevAuthRegistration();
};
