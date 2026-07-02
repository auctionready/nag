import { ScrollView, StyleSheet, View } from "react-native";
import { tokens } from "../components/theme";
import { Group, Row } from "../components/account/AccountUI";
import { iconClock } from "../components/account/icons";
import { set24HourClock, use24HourClock } from "../infrastructure/preferences";

/**
 * Account → Appearance. Display-only preferences. The 24-hour clock
 * toggle follows the device convention until the user flips it, after
 * which the explicit choice is persisted.
 */
export const AppearanceScreen = () => {
  const clock24 = use24HourClock();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Group title="Time">
        <Row
          icon={iconClock()}
          label="24-hour clock"
          toggle
          toggleOn={clock24}
          onPress={() => set24HourClock(!clock24)}
          last
        />
      </Group>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
});
