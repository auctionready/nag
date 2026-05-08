import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";

// Sub-control shown beneath the cadence pills when "ad-hoc" is selected.
// Just an explanatory note — there's nothing to configure.
export const AdHocCard = () => (
  <View style={styles.card}>
    <Text style={styles.text}>
      log it whenever — no schedule, no nags. just a streak counter.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.mute,
  },
});
