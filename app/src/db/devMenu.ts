import { Alert, DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearLocalAuth, loadIdentity } from "@nag/core";
import { ensureDevAuthRegistered } from "@nag/core/dev";
import { db, resetDatabaseSchema } from "./index";
import { clearAll, seedSampleData } from "./seed";
import { devFlags } from "../infrastructure/devFlags";
import { fetchDevToken } from "../infrastructure/devAuth";
import {
  getApiBaseUrl,
  getAuthMode,
  setBackendOverride,
  type BackendName,
} from "../infrastructure/devOverrides";
import { deviceTokenStore } from "../infrastructure/tokenStore";
import { log } from "../infrastructure/log";

const applyBackendPreset = async (name: BackendName): Promise<void> => {
  try {
    await setBackendOverride(name);
  } catch (error: unknown) {
    Alert.alert(
      "Backend not configured",
      error instanceof Error ? error.message : `Could not select ${name}`,
    );
    return;
  }
  // Sign-out (gated by `promptBackendSwitch`) has already reset
  // sync_state and reverted sent outbox rows to pending, so the next
  // boot will sign into the new backend and ship the existing queue
  // against the new account. No local wipe needed here.
  DevSettings.reload();
};

const promptBackendSwitch = async (): Promise<void> => {
  // Block switching while signed in — the outbox is queued against
  // that server account and shipping it to a different backend would
  // tie our local state to a server account we haven't authenticated
  // against yet. Sign out first; that resets sync_state and reverts
  // sent outbox rows to pending so the new backend gets the full
  // history. Applies equally to Clerk and dev-auth — dev-auth is a
  // drop-in replacement and has the same server-side account binding.
  const identity = await loadIdentity(db);
  if (identity?.accountId) {
    Alert.alert(
      "Sign out first",
      "Backend switching is disabled while signed in. Sign out, then switch backends — your local data and queued events will move with you.",
    );
    return;
  }
  const current = `${getApiBaseUrl()} (${getAuthMode()})`;
  Alert.alert(
    "Switch backend",
    `Current: ${current}\n\nPicking a preset reloads against the new backend. Local data and the outbox carry over.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Local — dev-auth",
        onPress: () => {
          void applyBackendPreset("local");
        },
      },
      {
        text: "Cloud apidev — clerk",
        onPress: () => {
          void applyBackendPreset("apidev");
        },
      },
    ],
  );
};

// Registration happens after `bootstrapDevOverrides()` resolves (see
// `_layout.tsx`) so the "Switch backend…" item can display the live
// URL. The menu re-registers on every reload, which is exactly when
// the backend can change.
export const registerDevMenu = (): void => {
  if (!__DEV__) return;
  registerDevMenuItems([
    {
      name: `Backend: ${getApiBaseUrl()} (${getAuthMode()})`,
      callback: () => {
        void promptBackendSwitch();
      },
    },
    {
      name: "Clear database",
      callback: async () => {
        await clearAll({ keepDeviceInfo: true });
        DevSettings.reload();
      },
    },
    {
      name: "Clear database (no refetch from server)",
      callback: async () => {
        await clearAll();
        DevSettings.reload();
      },
    },
    {
      name: "Clear whole device (simulate reinstall)",
      callback: () => {
        // Simulates an iOS reinstall: drops every local table (including
        // drizzle's migration tracking) and reloads. On the next launch
        // the fresh-install wipe in `wipeSecureStoreIfFreshInstall` sees
        // no migrations table and clears the secure-store device token
        // and Clerk JWT for us — exactly the same code path that runs
        // after a real uninstall + reinstall on iOS. Server-side state
        // is untouched.
        resetDatabaseSchema();
        DevSettings.reload();
      },
    },
    {
      name: "Seed sample data",
      callback: async () => {
        await clearAll();
        await seedSampleData();
        DevSettings.reload();
      },
    },
    {
      name: "Device token",
      callback: async () => {
        const token = await deviceTokenStore.get();
        Alert.alert("Device token", token ?? "<none>");
      },
    },
    {
      name: "Scheduled notifications",
      callback: () => {
        router.navigate("/debug-notifications");
      },
    },
    {
      name: "Toggle pull sync (no reload)",
      callback: () => {
        devFlags.disablePullSync = !devFlags.disablePullSync;
        console.log(
          `[dev] pull sync ${devFlags.disablePullSync ? "DISABLED" : "enabled"}`,
        );
      },
    },
    {
      name: "Re-sign-in as dev user",
      callback: async () => {
        // Wipes the local identity row and the secure-store device
        // token, then mints a fresh dev token via /dev/token. Useful
        // after the backend's HMAC secret rotates or after a Postgres
        // wipe — the cached token is stale and any request 401s.
        const logger = log("dev:resignin");
        await clearLocalAuth({ db, tokenStore: deviceTokenStore });
        const result = await ensureDevAuthRegistered({
          db,
          tokenStore: deviceTokenStore,
          fetchDevToken,
          log: logger,
        });
        if (!result.accountId) {
          Alert.alert(
            "Dev sign-in failed",
            result.result && "kind" in result.result
              ? `${result.result.kind}: ${result.result.message}`
              : "see logs",
          );
          return;
        }
        DevSettings.reload();
      },
    },
  ]).catch(() => {}); // no-op in Expo Go (native module unavailable)
};
