import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";
import { log } from "./log";

const logger = log("clerk");

type Extra = {
  clerkPublishableKey?: string;
};

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

export const getClerkPublishableKey = (): string | null => {
  const { clerkPublishableKey } = extra();
  return clerkPublishableKey && clerkPublishableKey.length > 0
    ? clerkPublishableKey
    : null;
};

export const isClerkConfigured = (): boolean =>
  getClerkPublishableKey() !== null;

/**
 * Tracks every secure-store key Clerk has touched this session, so the
 * "Clear whole device" dev tool can wipe the whole session and not just
 * a key it happened to know the name of. Populated in `getToken` and
 * `saveToken` (Clerk only asks for keys it intends to use), drained by
 * `clearAllClerkTokens`.
 */
const seenClerkKeys = new Set<string>();

/**
 * Token cache backed by `expo-secure-store`. Clerk requires this to persist
 * the current session JWT across app launches; without it the user would
 * have to re-authenticate every cold start.
 */
export const tokenCache: TokenCache = {
  async getToken(key) {
    seenClerkKeys.add(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      logger.warn(`SecureStore.getItemAsync failed for ${key}`, err);
      return null;
    }
  },
  async saveToken(key, value) {
    seenClerkKeys.add(key);
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      logger.warn(`SecureStore.setItemAsync failed for ${key}`, err);
    }
  },
  async clearToken(key) {
    seenClerkKeys.delete(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      logger.warn(`SecureStore.deleteItemAsync failed for ${key}`, err);
    }
  },
};

/**
 * Dev-tool helper: deletes every secure-store entry Clerk has touched
 * this session. Pairs with the "Clear whole device" menu item — without
 * this, the persisted Clerk session would survive the wipe and the
 * post-Clerk-sign-in effect would immediately re-register the just-cleared
 * device against the user's existing account, defeating the point of the
 * wipe. Best-effort: any key Clerk hasn't touched yet this run is left
 * alone, but the typical case (user signed in, hits the dev menu) has
 * Clerk's tokens loaded into the cache by then.
 */
export const clearAllClerkTokens = async (): Promise<void> => {
  const keys = Array.from(seenClerkKeys);
  seenClerkKeys.clear();
  await Promise.all(
    keys.map((key) =>
      SecureStore.deleteItemAsync(key).catch((err) => {
        logger.warn(`SecureStore.deleteItemAsync failed for ${key}`, err);
      }),
    ),
  );
  logger.info(`cleared ${keys.length} clerk token(s) from secure store`);
};
