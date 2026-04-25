import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "@nag/core";
import { log } from "./log";

const KEY = "nag.deviceToken";
const logger = log("tokenStore");

/**
 * `TokenStore` backed by `expo-secure-store` (iOS Keychain,
 * Android EncryptedSharedPreferences). The token is read on every
 * authenticated request, so we keep an in-memory cache to avoid the
 * native round-trip per call — invalidated when `set` or `clear` runs.
 *
 * Uses the same defaults as the Clerk token cache in `clerk.ts`:
 * Keychain entries are not synced to iCloud and survive app launches
 * but stay scoped to the current device.
 */
class SecureStoreTokenStore implements TokenStore {
  private cached: string | null = null;
  private loaded = false;

  async get(): Promise<string | null> {
    if (this.loaded) return this.cached;
    try {
      this.cached = await SecureStore.getItemAsync(KEY);
    } catch (err) {
      logger.warn(`SecureStore.getItemAsync failed for ${KEY}`, err);
      this.cached = null;
    }
    this.loaded = true;
    return this.cached;
  }

  async set(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY, token);
      this.cached = token;
      this.loaded = true;
    } catch (err) {
      logger.warn(`SecureStore.setItemAsync failed for ${KEY}`, err);
      throw err;
    }
  }

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch (err) {
      logger.warn(`SecureStore.deleteItemAsync failed for ${KEY}`, err);
    }
    this.cached = null;
    this.loaded = true;
  }
}

export const deviceTokenStore: TokenStore = new SecureStoreTokenStore();
