import { DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearAll, seedSampleData } from "./seed";
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
        await clearAll({ tokenStore: deviceTokenStore });
        await clearAllClerkTokens();
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
