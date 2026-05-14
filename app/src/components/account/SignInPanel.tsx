import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Svg, { Circle, Path } from "react-native-svg";
import { useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import { log } from "../../infrastructure/log";
import { tokens } from "../theme";
import { CredentialCodeForm } from "./CredentialCodeForm";
import { CredentialIdentifierForm } from "./CredentialIdentifierForm";
import {
  prepareCredentialFlow,
  requiredFieldMessage,
  verifyCredentialCode,
} from "./clerkHelpers";
import { SettingsGroups } from "./SettingsGroups";
import { SignInSheet } from "./SignInSheet";
import type { CredentialChannel, CredentialFlow, OAuthStrategy } from "./types";

// Required by Expo Auth Session so the OAuth redirect properly closes the
// in-app browser tab when control returns to the app.
WebBrowser.maybeCompleteAuthSession();

const logger = log("account");

export const SignInPanel = ({
  onFlowError,
}: {
  onFlowError: (message: string) => void;
}) => {
  const { startSSOFlow } = useSSO();
  const signInHook = useSignIn();
  const signUpHook = useSignUp();
  const [flow, setFlow] = React.useState<CredentialFlow>({ stage: "choose" });
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const onOAuth = React.useCallback(
    async (strategy: OAuthStrategy) => {
      try {
        const result = await startSSOFlow({
          strategy,
          redirectUrl: Linking.createURL("/oauth-redirect"),
        });

        const sessionId =
          result.createdSessionId ??
          result.signIn?.createdSessionId ??
          result.signUp?.createdSessionId ??
          null;

        if (sessionId && result.setActive) {
          await result.setActive({ session: sessionId });
          return;
        }

        const missing = result.signUp?.missingFields ?? [];
        const unverified = result.signUp?.unverifiedFields ?? [];
        logger.warn(
          `SSO completed without a session — strategy=${strategy} signIn.status=${result.signIn?.status} signUp.status=${result.signUp?.status} missing=${JSON.stringify(missing)} unverified=${JSON.stringify(unverified)}`,
        );
        const reason =
          missing.length > 0
            ? `Clerk requires ${missing.join(", ")} — relax sign-up requirements in the Clerk dashboard`
            : "sign-in completed but no session was created";
        onFlowError(reason);
      } catch (err) {
        logger.error(`SSO flow threw strategy=${strategy}`, err);
        onFlowError(err instanceof Error ? err.message : "sign-in failed");
      }
    },
    [startSSOFlow, onFlowError],
  );

  const startCredentialFlow = (channel: CredentialChannel) => {
    setSheetOpen(false);
    setFlow({ stage: "identifier", channel, value: "", busy: false });
  };

  const startOAuth = (strategy: OAuthStrategy) => {
    setSheetOpen(false);
    void onOAuth(strategy);
  };

  const submitIdentifier = async () => {
    if (flow.stage !== "identifier") return;
    if (!signInHook.isLoaded || !signUpHook.isLoaded) return;
    const identifier = flow.value.trim();
    if (!identifier) {
      setFlow({ ...flow, error: requiredFieldMessage(flow.channel) });
      return;
    }
    setFlow({ ...flow, busy: true, error: undefined });
    try {
      const mode = await prepareCredentialFlow({
        channel: flow.channel,
        identifier,
        signIn: signInHook.signIn,
        signUp: signUpHook.signUp,
      });
      setFlow({
        stage: "code",
        channel: flow.channel,
        mode,
        identifier,
        code: "",
        busy: false,
      });
    } catch (err) {
      logger.error(`credential prep failed channel=${flow.channel}`, err);
      setFlow({
        ...flow,
        busy: false,
        error: err instanceof Error ? err.message : "could not start sign-in",
      });
    }
  };

  const submitCode = async () => {
    if (flow.stage !== "code") return;
    if (!signInHook.isLoaded || !signUpHook.isLoaded) return;
    const code = flow.code.trim();
    if (!code) {
      setFlow({ ...flow, error: "Enter the verification code" });
      return;
    }
    setFlow({ ...flow, busy: true, error: undefined });
    try {
      await verifyCredentialCode({
        channel: flow.channel,
        mode: flow.mode,
        code,
        signIn: signInHook.signIn,
        signUp: signUpHook.signUp,
        setActive: signInHook.setActive,
      });
    } catch (err) {
      logger.error(
        `credential verify failed channel=${flow.channel} mode=${flow.mode}`,
        err,
      );
      setFlow({
        ...flow,
        busy: false,
        error: err instanceof Error ? err.message : "verification failed",
      });
    }
  };

  if (flow.stage === "identifier") {
    return (
      <CredentialIdentifierForm
        flow={flow}
        onChange={(value) => setFlow({ ...flow, value, error: undefined })}
        onSubmit={() => void submitIdentifier()}
        onBack={() => setFlow({ stage: "choose" })}
      />
    );
  }
  if (flow.stage === "code") {
    return (
      <CredentialCodeForm
        flow={flow}
        onChange={(code) => setFlow({ ...flow, code, error: undefined })}
        onSubmit={() => void submitCode()}
        onBack={() =>
          setFlow({
            stage: "identifier",
            channel: flow.channel,
            value: flow.identifier,
            busy: false,
          })
        }
      />
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          style={({ pressed }) => [
            styles.ctaCard,
            pressed && styles.ctaPressed,
          ]}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Sign in to back up and sync"
        >
          <View style={styles.ctaAvatar}>
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.mute}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Circle cx={12} cy={9} r={3.5} />
              <Path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
            </Svg>
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Not signed in</Text>
            <Text style={styles.ctaBody} numberOfLines={2}>
              Sign in to back up &amp; sync across devices.
            </Text>
          </View>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Sign in</Text>
          </View>
        </Pressable>

        <SettingsGroups />

        <View style={{ height: 32 }} />
      </ScrollView>

      <SignInSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onApple={() => startOAuth("oauth_apple")}
        onGoogle={() => startOAuth("oauth_google")}
        onEmail={() => startCredentialFlow("email")}
        onPhone={() => startCredentialFlow("phone")}
      />
    </>
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
  ctaCard: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 14,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ctaPressed: {
    opacity: 0.7,
  },
  ctaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,20,16,0.04)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(26,20,16,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    flex: 1,
    minWidth: 0,
  },
  ctaTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.14,
    lineHeight: 17,
  },
  ctaBody: {
    fontSize: 11.5,
    lineHeight: 15.5,
    color: tokens.mute,
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: tokens.ink,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  ctaButtonText: {
    color: tokens.cream,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.06,
  },
});
