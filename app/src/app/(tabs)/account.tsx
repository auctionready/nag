import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SignedInOrOut } from "../../components/account";
import { confirmAndDeleteAccount } from "../../components/account/deleteAccountAction";
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
          <Pressable
            onPress={confirmAndDeleteAccount}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
          >
            <Text style={styles.deleteButtonText}>Delete account</Text>
          </Pressable>
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
  deleteButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "700",
    color: tokens.orange,
    letterSpacing: -0.07,
  },
});
