import * as SecureStore from "expo-secure-store";
import { isLocalDatabaseEmpty } from "../db";
import { log } from "./log";

const logger = log("freshInstall");

// Clerk-expo (`@clerk/clerk-expo`) calls `tokenCache.saveToken(KEY, jwt)`
// with this exact key — see `provider/singleton/createClerkInstance` in
// the SDK. Hardcoded so we can wipe it before `ClerkProvider` mounts on
// the first launch after a reinstall, without depending on Clerk having
// touched the key this session.
const CLERK_JWT_KEY = "__clerk_client_jwt";
const DEVICE_TOKEN_KEY = "nag.deviceToken";
// Mirrors `BACKEND_KEY` in devOverrides.ts. Hardcoded here so the wipe
// stays a leaf module with no dev-menu dependency.
const BACKEND_OVERRIDE_KEY = "nag.devOverride.backend";

/**
 * On iOS the Keychain (and so `expo-secure-store`) survives app
 * reinstalls, while the app sandbox — including our SQLite file — does
 * not. Without intervention the user would reinstall the app and still
 * appear signed in, because the cached Clerk session JWT and our
 * device token outlive the wipe. This runs synchronously enough at
 * startup that it completes before `ClerkProvider` mounts and reads
 * the JWT.
 */
export const wipeSecureStoreIfFreshInstall = async (): Promise<void> => {
  if (!isLocalDatabaseEmpty()) return;
  logger.info("fresh install detected — wiping persisted auth tokens");
  await Promise.all(
    [DEVICE_TOKEN_KEY, CLERK_JWT_KEY, BACKEND_OVERRIDE_KEY].map((key) =>
      SecureStore.deleteItemAsync(key).catch((err) => {
        logger.warn(`SecureStore.deleteItemAsync failed for ${key}`, err);
      }),
    ),
  );
};
