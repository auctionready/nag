import { withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

const { Navigator } = createMaterialTopTabNavigator();

const TopTabs = withLayoutContext(Navigator);

export const TabsLayout = () => {
  return (
    <TopTabs
      screenOptions={{
        swipeEnabled: true,
        tabBarStyle: { display: "none" },
      }}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="calendar" />
    </TopTabs>
  );
};
export default TabsLayout;
