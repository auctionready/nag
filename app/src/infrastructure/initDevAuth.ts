import { ensureDevAuthRegistered } from "@nag/core";
import { db } from "../db";
import { fetchDevToken } from "./devAuth";
import { postCommitBus } from "./postCommitBus";
import { deviceTokenStore } from "./tokenStore";
import { log } from "./log";

const logger = log("identity");

/**
 * Dev-auth boot path: mints a token via the backend's DEBUG-only
 * `GET /dev/token` and pins the local identity row to the
 * SwaggerDevAuth account/device pair. Lives in its own module so
 * `init.ts` can require it lazily under a `__DEV__` guard, keeping
 * `fetchDevToken` and `ensureDevAuthRegistered` out of production
 * bundles.
 */
export const runDevAuthRegistration = async (): Promise<void> => {
  try {
    const result = await ensureDevAuthRegistered({
      db,
      tokenStore: deviceTokenStore,
      fetchDevToken,
      log: logger,
    });
    if (result.accountId) {
      // Wake the sync loop now that we have credentials — same pattern
      // as the post-`/accounts/upgrade` kick from the Account screen.
      postCommitBus.emit();
    }
  } catch (error: unknown) {
    logger.error("dev-auth init threw unexpectedly", error);
  }
};
