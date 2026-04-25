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
 * Token cache backed by `expo-secure-store`. Clerk requires this to persist
 * the current session JWT across app launches; without it the user would
 * have to re-authenticate every cold start.
 */
export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      logger.warn(`SecureStore.getItemAsync failed for ${key}`, err);
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      logger.warn(`SecureStore.setItemAsync failed for ${key}`, err);
    }
  },
  async clearToken(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      logger.warn(`SecureStore.deleteItemAsync failed for ${key}`, err);
    }
  },
};
