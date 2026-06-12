import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { BoardScreen } from "../../screens/BoardScreen";
import { tokens } from "../../components/theme";
import { getDefaultView } from "../../infrastructure/preferences";

// The "Open on day view" preference applies to the launch render only —
// afterwards the today tab must always show the board. Module state is
// per JS context, i.e. reset on every app launch, which is exactly the
// lifetime the launch redirect needs.
let launchHandled = false;

const BoardRoute = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  // The app always launches at "/", which is this route — the tab
  // navigator's `initialRouteName` can't change that. Hop to the calendar
  // once, on launch, and only when "/" really is the launch destination
  // (a notification/deep link elsewhere wins over the preference).
  useEffect(() => {
    if (launchHandled) return;
    launchHandled = true;
    if (pathname === "/" && getDefaultView() === "day") {
      router.replace("/calendar");
    }
  }, [router, pathname]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BoardScreen />
    </View>
  );
};

export default BoardRoute;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
});
