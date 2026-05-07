import { Alert, DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearAll, seedSampleData } from "./seed";
import { resetDatabaseSchema } from "./index";
import { devFlags } from "../infrastructure/devFlags";
import { clearAllClerkTokens } from "../infrastructure/clerk";
import { deviceTokenStore } from "../infrastructure/tokenStore";

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
