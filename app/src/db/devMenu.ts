import { Alert, DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearAll, seedSampleData } from "./seed";
import { resetDatabaseSchema } from "./index";
import { devFlags } from "../infrastructure/devFlags";
import { clearAllClerkTokens } from "../infrastructure/clerk";
import { deviceTokenStore } from "../infrastructure/tokenStore";
import { deleteAccount } from "../infrastructure/apiClient";
import { log } from "../infrastructure/log";

if (__DEV__) {
  registerDevMenuItems([
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
      name: "Clear whole device",
      callback: async () => {
        // Like "Clear database (no refetch from server)" but also clears
        // the secure-store device token *and* Clerk's persisted session,
        // so the next launch is a true first-install: new deviceId, no
        // leftover device token, no accountId, and no signed-in Clerk
        // user (otherwise the post-Clerk-sign-in effect would immediately
        // re-register the just-wiped device). Server-side state is
        // untouched.
        //
        // Drops every table (including drizzle's migration tracking)
        // rather than truncating rows so the migrator re-runs from
        // scratch on reload — covers schema-breaking changes that
        // `clearAll` can't recover from.
        await deviceTokenStore.clear();
        await clearAllClerkTokens();
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
      name: "Delete my account (server + local)",
      callback: () => {
        // Two-stage confirm because this is irreversible: the server
        // hard-deletes events, devices, read models, and the account
        // row, and we then wipe local SQLite + tokens so the next
        // launch is a fresh first-install. The current device token
        // is what the API uses to identify the caller, so the
        // delete itself must run *before* we clear the token store.
        Alert.alert(
          "Delete account",
          "This permanently deletes your account, every device paired to " +
            "it, and all server-side habit/check-in data. Local data on " +
            "this device will also be wiped. There is no undo.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                const logger = log("dev:delete-account");
                const result = await deleteAccount();
                if (!result.ok) {
                  logger.error("delete failed", result);
                  Alert.alert(
                    "Delete failed",
                    `${result.kind === "non-retriable" ? `HTTP ${result.status}: ` : ""}${result.message}`,
                  );
                  return;
                }
                logger.info(
                  `server account deleted (${result.accountId}) — wiping local state`,
                );
                await deviceTokenStore.clear();
                await clearAllClerkTokens();
                resetDatabaseSchema();
                DevSettings.reload();
              },
            },
          ],
        );
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
  ]).catch(() => {}); // no-op in Expo Go (native module unavailable)
}
