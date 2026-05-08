import { withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { SharedTopBar } from "../../components/shell";

const { Navigator } = createMaterialTopTabNavigator();

const TopTabs = withLayoutContext(Navigator);

const TabsLayout = () => {
  return (
    <TopTabs
      initialRouteName="index"
      tabBar={(props) => <SharedTopBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
      }}
    >
      <TopTabs.Screen name="account" />
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="calendar" />
    </TopTabs>
  );
};
export default TabsLayout;
