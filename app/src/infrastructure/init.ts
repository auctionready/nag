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
 * have finished. In dev builds, lazy-requires `initDevAuth.ts` which
 * inspects `getAuthMode()` + the local identity and refreshes the
 * dev-auth device token if an already-signed-in session lost its
 * secure-store token (fresh install carryover, HMAC-secret rotation).
 * Fresh installs and explicit sign-outs leave `accountId` null, so
 * this no-ops and the user must hit "Sign in as dev user" from the
 * Account screen.
 *
 * The dev-auth bootstrap is wrapped in `if (__DEV__) { require(...) }`
 * exactly — same pattern as the `require("../db/devMenu")` in
 * `_layout.tsx` — so Metro's prod minifier drops the require call
 * (and consequently `initDevAuth.ts`, `fetchDevToken`, and the
 * `/dev/token` URL) from release bundles. Any indirection
 * (`if (!__DEV__) return;` followed by `require(...)`, or a `require`
 * nested inside an async IIFE) leaves the dependency graph intact:
 * verify via `pnpm expo export --platform ios --no-bytecode` and grep
 * the emitted `dist/_expo/static/js/ios/entry-*.js` for `/dev/token`,
 * `signed out (dev-auth)`, etc. — they should be absent.
 */
export const postMigrationInit = () => {
  if (__DEV__) {
    const { runDevAuthBootstrap } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./initDevAuth") as typeof import("./initDevAuth");
    void runDevAuthBootstrap();
  }
};
