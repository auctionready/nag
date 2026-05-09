import * as Sentry from "@sentry/react-native";
import {
  ensureDevAuthRegistered,
  setNotificationScheduler,
  setConsolidatedScheduler,
} from "@nag/core";
import { db } from "../db";
import { expoNotificationScheduler } from "./expoNotificationScheduler";
import { expoConsolidatedScheduler } from "./expoConsolidatedScheduler";
import { installGlobalErrorHandlers } from "./globalErrorHandlers";
import { fetchDevToken } from "./devAuth";
import { getAuthMode } from "./devOverrides";
import { postCommitBus } from "./postCommitBus";
import { deviceTokenStore } from "./tokenStore";
import { log } from "./log";

const logger = log("init");
const identityLogger = log("identity");

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
 */
export const postMigrationInit = () => {
  if (getAuthMode() !== "dev-auth") return;
  void runDevAuthRegistration();
};

const runDevAuthRegistration = async () => {
  try {
    const result = await ensureDevAuthRegistered({
      db,
      tokenStore: deviceTokenStore,
      fetchDevToken,
      log: identityLogger,
    });
    if (result.accountId) {
      // Wake the sync loop now that we have credentials — same pattern
      // as the post-`/accounts/upgrade` kick from the Account screen.
      postCommitBus.emit();
    }
  } catch (error: unknown) {
    identityLogger.error("dev-auth init threw unexpectedly", error);
  }
};
