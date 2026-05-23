// Sentry must initialize before any other module that may emit spans or
// errors — notably the db module, which opens SQLite at import time.
import { Sentry, navigationIntegration } from "../infrastructure/sentry";
import { init } from "../infrastructure/init";
import { useNotificationResponseHandler } from "../infrastructure/notificationResponseHandler";
import { useForegroundNotificationSync } from "../infrastructure/foregroundSync";
import { useBadgeSync } from "../infrastructure/badgeSync";
import { SyncStatusProvider } from "../infrastructure/syncStatus";
import { TodayProvider } from "../infrastructure/today";
import { SyncHaltedBanner } from "../components/sync";
import {
  AppHeader,
  AnimatedSplash,
  SPLASH_DURATION_MS,
} from "../components/shell";
import { getClerkPublishableKey, tokenCache } from "../infrastructure/clerk";
import { bootstrapDevOverrides } from "../infrastructure/devOverrides";
import { wipeSecureStoreIfFreshInstall } from "../infrastructure/freshInstall";
import { ClerkProvider } from "@clerk/clerk-expo";
import React from "react";
import { View } from "react-native";
import { useNavigationContainerRef, Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "../db/DatabaseProvider";
import { useShowSplash } from "../hooks/useShowSplash";
// Dev-menu registration is deferred until after `bootstrapDevOverrides`
// resolves so the "Backend: …" item can display the live URL. Wrap the
// require in a `__DEV__` guard so Metro drops the dev-menu subtree
// (and its dev-only `@nag/core` imports) from production bundles.

// Keep the native splash up until fonts load and the JS animated splash mounts;
// then we hide it and run the reveal animation.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

init();

const InnerLayout = () => {
  useNotificationResponseHandler();
  useForegroundNotificationSync();
  useBadgeSync();

  return (
    <View style={{ flex: 1 }}>
      <SyncHaltedBanner />
      <Stack
        screenOptions={{
          header: (props) => <AppHeader {...props} />,
          contentStyle: { backgroundColor: "#FFF8F0" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ title: "Nag HQ", headerShown: false }}
        />
        <Stack.Screen name="admin" options={{ title: "Admin" }} />
        <Stack.Screen name="add-habit" options={{ title: "Add Habit" }} />
        <Stack.Screen
          name="habit/[id]/index"
          options={{ title: "Habit", headerShown: false }}
        />
        <Stack.Screen
          name="habit/[id]/history"
          options={{ title: "Habit History", headerShown: false }}
        />
        <Stack.Screen
          name="habit/[id]/edit"
          options={{ title: "Edit Habit" }}
        />
        <Stack.Screen
          name="debug-notifications"
          options={{ title: "Scheduled Notifications" }}
        />
        <Stack.Screen
          name="check-in-time-slot"
          options={{ title: "Check In" }}
        />
      </Stack>
    </View>
  );
};

// `ClerkProvider` is a no-op (just renders children) when the publishable
// key isn't configured — keeps local dev / preview builds usable without
// requiring Clerk credentials. Hooks like `useAuth` will report
// `isLoaded: true, isSignedIn: false` in that case.
// `ClerkProvider` is a no-op (just renders children) when the publishable
// key isn't configured — keeps dev / preview builds usable without Clerk.
const ClerkOrPassthrough = ({ children }: { children: React.ReactNode }) => {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
};

const RootLayout = () => {
  const ref = useNavigationContainerRef();
  const [fontsLoaded] = useFonts({
    "SpaceGrotesk-Bold": require("../../assets/fonts/SpaceGrotesk-Bold.otf"),
    "JetBrainsMono-Regular": require("../../assets/fonts/JetBrainsMono-Regular.ttf"),
  });
  // Dev-menu backend overrides are stored in SecureStore (read async).
  // Block render until they've been folded into the session-pinned
  // `getAuthMode()` / `getApiBaseUrl()` constants — otherwise the
  // first apiClient build or ClerkProvider render would see env values
  // even when the user has overridden them. The same gate also waits
  // for the fresh-install secure-store wipe, so `ClerkProvider` never
  // sees a Keychain-cached JWT from a previous install.
  const [overridesLoaded, setOverridesLoaded] = React.useState(false);
  const showSplash = useShowSplash({
    fontsLoaded: fontsLoaded ?? false,
    minShowMs: SPLASH_DURATION_MS,
  });

  React.useEffect(() => {
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  React.useEffect(() => {
    Promise.all([bootstrapDevOverrides(), wipeSecureStoreIfFreshInstall()])
      .then(() => {
        if (__DEV__) {
          // prettier-ignore
          (
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("../db/devMenu") as typeof import("../db/devMenu")
          ).registerDevMenu();
        }
      })
      .finally(() => setOverridesLoaded(true));
  }, []);

  // Native splash stays up until fonts load. Once we render
  // <AnimatedSplash />, it calls SplashScreen.hideAsync() on its first frame
  // so the icon stays visible across the hand-off.
  if (!fontsLoaded || !overridesLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkOrPassthrough>
        <DatabaseProvider>
          <SyncStatusProvider>
            <TodayProvider>
              <InnerLayout />
            </TodayProvider>
          </SyncStatusProvider>
        </DatabaseProvider>
      </ClerkOrPassthrough>
      {showSplash && <AnimatedSplash />}
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
