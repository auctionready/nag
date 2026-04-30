import { DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearAll, seedSampleData } from "./seed";
import { devFlags } from "../infrastructure/devFlags";

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
