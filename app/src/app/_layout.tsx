import "../db/devMenu";
import { init } from "../init";
import { Stack } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "../db/DatabaseProvider";

init();

const RootLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ title: "Board" }} />
          <Stack.Screen name="admin" options={{ title: "Admin" }} />
          <Stack.Screen name="add-habit" options={{ title: "Add Habit" }} />
          <Stack.Screen name="habit/[id]" options={{ title: "Habit" }} />
          <Stack.Screen
            name="edit-habit/[id]"
            options={{ title: "Edit Habit" }}
          />
          <Stack.Screen
            name="debug-notifications"
            options={{ title: "Scheduled Notifications" }}
          />
        </Stack>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
};
export default RootLayout;
