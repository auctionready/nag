import { View, StyleSheet } from "react-native";
import { SharedTopBar } from "../../components/shell";
import { BoardScreen } from "../../screens/BoardScreen";
import { tokens } from "../../components/theme";

const BoardRoute = () => (
  <View style={styles.container}>
    <SharedTopBar />
    <BoardScreen />
  </View>
);

export default BoardRoute;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
});
