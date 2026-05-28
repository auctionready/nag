import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { TabView, SceneMap } from "react-native-tab-view";
import { SharedTopBar } from "../../components/shell";
import { AccountScreen } from "../../screens/AccountScreen";
import { BoardScreen } from "../../screens/BoardScreen";
import { CalendarScreen } from "../../screens/CalendarScreen";

const renderScene = SceneMap({
  account: AccountScreen,
  index: BoardScreen,
  calendar: CalendarScreen,
});

const routes = [{ key: "account" }, { key: "index" }, { key: "calendar" }];

const TabsLayout = () => {
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(1);

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      renderTabBar={(props) => (
        <SharedTopBar
          navigationState={props.navigationState}
          jumpTo={props.jumpTo}
        />
      )}
      onIndexChange={setIndex}
      initialLayout={{ width: layout.width }}
      swipeEnabled
    />
  );
};

export default TabsLayout;
