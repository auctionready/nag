import { ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { SettingsGroups } from "./SettingsGroups";

// Account tab for local-only builds (EXPO_PUBLIC_LOCAL_ONLY). There's no
// sign-in and no backend, so instead of a sign-in CTA we explain the
// on-device model and still surface the local settings rows (appearance,
// archived habits, about). This is the copy App Review sees on the Account
// tab — it must read as a finished feature, not a disabled one.
export const LocalOnlyAccountPanel = () => (
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.scrollContent}
  >
    <View style={styles.intro}>
      <Text style={styles.title}>all on this device.</Text>
      <Text style={styles.body}>
        nag keeps your habits and check-ins on this iPhone — no account, no
        cloud, nothing leaves the device. Backup and sync across devices are
        coming in a future update.
      </Text>
    </View>

    <SettingsGroups />

    <View style={{ height: 32 }} />
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.mute,
  },
});
