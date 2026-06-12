import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BoardScreen } from "../../screens/BoardScreen";
import { tokens } from "../../components/theme";

const BoardRoute = () => {
  const insets = useSafeAreaInsets();
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
