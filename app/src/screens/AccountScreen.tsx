import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SignedInOrOut } from "../components/account";
import { tokens } from "../components/theme";
import { isClerkConfigured } from "../infrastructure/clerk";
import { getAuthMode } from "../infrastructure/devOverrides";

export const AccountScreen = () => {
  if (__DEV__ && getAuthMode() === "dev-auth") {
    // Lazy-required so Metro drops the dev-auth panel (and its
    // /dev/token + ensureDevAuthRegistered imports) from prod bundles.
    const { DevAuthAccountPanel } =
      require("../components/account/DevAuthAccountPanel") as typeof import("../components/account/DevAuthAccountPanel");
    return <DevAuthAccountPanel />;
  }
  if (!isClerkConfigured()) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.unconfigured}>
          <Text style={styles.unconfiguredTitle}>account not configured.</Text>
          <Text style={styles.unconfiguredBody}>
            Sign-in is disabled in this build. Set
            <Text style={styles.code}> EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY </Text>
            and rebuild.
          </Text>
        </View>
      </ScrollView>
    );
  }
  return <SignedInOrOut />;
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
  unconfigured: {
    padding: 24,
    gap: 10,
  },
  unconfiguredTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  unconfiguredBody: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.mute,
  },
  code: {
    fontFamily: "JetBrainsMono",
    fontSize: 12,
  },
});
