import { Tabs } from "expo-router/js-tabs";
import { BottomTabBar } from "../../components/shell";
import { getDefaultView } from "../../infrastructure/preferences";

const TabsLayout = () => (
  // The actual launch redirect lives in `(tabs)/index.tsx` — the app
  // always opens at "/", so `initialRouteName` can't switch the launch
  // screen. It still anchors tab back-behaviour, so keep it aligned with
  // the preference. Reading it synchronously is safe: the root layout
  // gates rendering on `bootstrapPreferences`.
  <Tabs
    initialRouteName={getDefaultView() === "day" ? "calendar" : "index"}
    screenOptions={{ headerShown: false }}
    tabBar={(props) => <BottomTabBar {...props} />}
  >
    <Tabs.Screen name="index" options={{ title: "Nag HQ" }} />
    <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
    <Tabs.Screen name="account" options={{ title: "Account" }} />
  </Tabs>
);

export default TabsLayout;
