import { StyleSheet, View } from "react-native";
import { AppHeaderShell } from "../../components/shell";
import { AccountScreen } from "../../screens/AccountScreen";
import { tokens } from "../../components/theme";

const AccountRoute = () => (
  <View style={styles.container}>
    <AppHeaderShell title="Account" />
    <AccountScreen />
  </View>
);

export default AccountRoute;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
});
