import { DevSettings } from "react-native";
import { registerDevMenuItems } from "expo-dev-client";
import { clearAll, seedSampleData } from "./seed";

if (__DEV__) {
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
  ]);
}
