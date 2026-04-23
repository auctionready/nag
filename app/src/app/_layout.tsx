import "../db/devMenu";
import { init } from "../infrastructure/init";
import { useNotificationResponseHandler } from "../infrastructure/notificationResponseHandler";
import { useForegroundNotificationSync } from "../infrastructure/foregroundSync";
import { Stack } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "../db/DatabaseProvider";

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://08efe873f2d78ca522c637c112347142@o4511267724001280.ingest.de.sentry.io/4511267736649808",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

init();

const InnerLayout = () => {
  useNotificationResponseHandler();
  useForegroundNotificationSync();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ title: "Nag HQ" }} />
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
      <Stack.Screen name="add-habit" options={{ title: "Add Habit" }} />
      <Stack.Screen name="habit/[id]" options={{ title: "Habit" }} />
      <Stack.Screen name="edit-habit/[id]" options={{ title: "Edit Habit" }} />
      <Stack.Screen
        name="debug-notifications"
        options={{ title: "Scheduled Notifications" }}
      />
      <Stack.Screen name="check-in-slot" options={{ title: "Check In" }} />
    </Stack>
  );
};

const RootLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <InnerLayout />
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
