// Sentry must initialize before any other module that may emit spans or
// errors — notably the db module, which opens SQLite at import time.
import { Sentry, navigationIntegration } from "../infrastructure/sentry";
import "../db/devMenu";
import { init } from "../infrastructure/init";
import { useNotificationResponseHandler } from "../infrastructure/notificationResponseHandler";
import { useForegroundNotificationSync } from "../infrastructure/foregroundSync";
import { SyncStatusProvider } from "../infrastructure/syncStatus";
import { SyncHaltedBanner } from "../components/SyncHaltedBanner";
import { SyncStatusPill } from "../components/SyncStatusPill";
import React from "react";
import { View } from "react-native";
import { useNavigationContainerRef, Stack } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "../db/DatabaseProvider";

init();

const InnerLayout = () => {
  useNotificationResponseHandler();
  useForegroundNotificationSync();

  return (
    <View style={{ flex: 1 }}>
      <SyncHaltedBanner />
      <Stack
        screenOptions={{
          headerRight: () => <SyncStatusPill />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: "Nag HQ" }} />
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
        <Stack.Screen name="check-in-slot" options={{ title: "Check In" }} />
      </Stack>
    </View>
  );
};

const RootLayout = () => {
  const ref = useNavigationContainerRef();

  React.useEffect(() => {
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <SyncStatusProvider>
          <InnerLayout />
        </SyncStatusProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
