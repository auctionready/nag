import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SignedInOrOut } from "../../components/account";
import { tokens } from "../../components/theme";
import { isClerkConfigured } from "../../infrastructure/clerk";
import { getApiBaseUrl, getAuthMode } from "../../infrastructure/devOverrides";

const AccountScreen = () => {
  if (getAuthMode() === "dev-auth") {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.unconfigured}>
          <Text style={styles.unconfiguredTitle}>signed in as dev user.</Text>
          <Text style={styles.unconfiguredBody}>
            This session is using a local HMAC device token from
            <Text style={styles.code}> /dev/token</Text> against
            <Text style={styles.code}> {getApiBaseUrl()}</Text>. The same
            account is wired into Swagger UI. Use the dev menu to switch backend
            or re-sign-in.
          </Text>
        </View>
      </ScrollView>
    );
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

export default AccountScreen;

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
