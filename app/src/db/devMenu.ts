import { DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { clearAll, seedSampleData } from "./seed";

if (__DEV__) {
  try {
    registerDevMenuItems([
      {
        name: "Clear database",
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
    ]);
  } catch {} // no-op in Expo Go (native module unavailable)
}
