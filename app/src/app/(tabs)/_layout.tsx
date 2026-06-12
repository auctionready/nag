import { Tabs } from "expo-router/js-tabs";
import { BottomTabBar } from "../../components/shell";
import { getDefaultView } from "../../infrastructure/preferences";

const TabsLayout = () => (
  // `getDefaultView` is safe to read synchronously here — the root layout
  // gates rendering on `bootstrapPreferences`. The navigator only consults
  // `initialRouteName` on first mount, so later preference changes apply
  // from the next cold start (deep links still override it).
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
