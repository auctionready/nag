import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  useAuth,
  useSignIn,
  useSignUp,
  useSSO,
  useUser,
} from "@clerk/clerk-expo";
import { loadIdentity } from "@nag/core";
import { db } from "../db";
import { unbindAccount, upgradeAccount } from "../infrastructure/apiClient";
import { isClerkConfigured } from "../infrastructure/clerk";
import { log } from "../infrastructure/log";

// Required by Expo Auth Session so the OAuth redirect properly closes the
// in-app browser tab when control returns to the app.
WebBrowser.maybeCompleteAuthSession();

const logger = log("account");

type UpgradeStatus =
  | { kind: "idle" }
  | { kind: "in-progress" }
  | { kind: "ok" }
  | { kind: "fail"; message: string };

type CredentialChannel = "email" | "phone";
type CredentialMode = "sign-in" | "sign-up";

type CredentialFlow =
  | { stage: "choose" }
  | {
      stage: "identifier";
      channel: CredentialChannel;
      value: string;
      busy: boolean;
      error?: string;
    }
  | {
      stage: "code";
      channel: CredentialChannel;
      mode: CredentialMode;
      identifier: string;
      code: string;
      busy: boolean;
      error?: string;
    };

type OAuthStrategy = "oauth_google" | "oauth_apple";

const AccountScreen = () => {
  if (!isClerkConfigured()) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>
          Sign-in is not configured in this build. Set
          <Text style={styles.code}>
            {" "}
            EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
          </Text>{" "}
          and rebuild.
        </Text>
      </View>
    );
  }
  return <SignedInOrOut />;
};

export default AccountScreen;

const SignedInOrOut = () => {
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();
  const [status, setStatus] = React.useState<UpgradeStatus>({ kind: "idle" });

  // Tracks whether we've already kicked off an upgrade for the current
  // signed-in session. Reset when the user signs out. Using a ref instead
  // of `status.kind` as the guard avoids feedback loops: any `setStatus`
  // call inside the effect would otherwise change a dep, fire cleanup,
  // and silently cancel the pending API call.
  const upgradeStarted = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded) return;

    // On sign-out, reset both the run-once flag and any visible status so a
    // subsequent sign-in starts fresh.
    if (!isSignedIn) {
      upgradeStarted.current = false;
      setStatus((current) =>
        current.kind === "idle" ? current : { kind: "idle" },
      );
      return;
    }

    if (upgradeStarted.current) return;
    upgradeStarted.current = true;

    // Deliberately no `cancelled` flag: the previous version blocked
    // setStatus on cleanup, but effect cleanup runs whenever any dep
    // changes (including Clerk re-creating `getToken`). The API result
    // would land after cleanup and the success-state update would be
    // silently swallowed, leaving the UI stuck on "linking your account…"
    // even though the server logged 200.
    void (async () => {
      setStatus({ kind: "in-progress" });
      try {
        const identity = await loadIdentity(db);
        if (!identity) {
          setStatus({
            kind: "fail",
            message: "no local device identity — restart the app",
          });
          return;
        }
        const idpToken = await getToken();
        if (!idpToken) {
          setStatus({ kind: "fail", message: "no IdP token from Clerk" });
          return;
        }
        const result = await upgradeAccount({
          deviceId: identity.deviceId,
          idpToken,
        });
        if (result.ok) {
          logger.info(
            `account upgraded accountId=${result.accountId} sub=${result.idpSubject}`,
          );
          setStatus({ kind: "ok" });
        } else {
          setStatus({ kind: "fail", message: result.message });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("upgrade flow threw", err);
        setStatus({ kind: "fail", message });
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <SignInPanel
        onFlowError={(message) => setStatus({ kind: "fail", message })}
      />
    );
  }

  return (
    <SignedInView
      identifier={
        user?.primaryEmailAddress?.emailAddress ??
        user?.primaryPhoneNumber?.phoneNumber ??
        user?.id ??
        "unknown"
      }
      status={status}
      setStatus={setStatus}
      signOut={signOut}
      onUnlinked={() => {
        // Reset the run-once latch so the next sign-in (potentially a
        // different connector) re-runs the upgrade flow against the now-
        // anonymous account.
        upgradeStarted.current = false;
      }}
    />
  );
};

type UnlinkStatus =
  | { kind: "idle" }
  | { kind: "in-progress" }
  | { kind: "fail"; message: string };

const SignedInView = ({
  identifier,
  status,
  setStatus,
  signOut,
  onUnlinked,
}: {
  identifier: string;
  status: UpgradeStatus;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  signOut: () => Promise<void>;
  onUnlinked: () => void;
}) => {
  const [unlink, setUnlink] = React.useState<UnlinkStatus>({ kind: "idle" });

  const onUnlink = React.useCallback(async () => {
    // Edge case worth knowing: any second device that has NOT yet paired
    // (`/devices/pair`) will see "no account found for this identity"
    // until some device re-binds via `/accounts/upgrade`. Devices already
    // paired hold their own HMAC device token and keep working.
    setUnlink({ kind: "in-progress" });
    try {
      const result = await unbindAccount();
      if (!result.ok) {
        setUnlink({ kind: "fail", message: result.message });
        return;
      }
      logger.info(`account unbound accountId=${result.accountId}`);
      onUnlinked();
      setStatus({ kind: "idle" });
      setUnlink({ kind: "idle" });
      // Sign out of Clerk so the next attempt starts from the connector
      // picker rather than silently re-using the stale Clerk session.
      await signOut();
    } catch (err) {
      logger.error("unlink flow threw", err);
      setUnlink({
        kind: "fail",
        message: err instanceof Error ? err.message : "unlink failed",
      });
    }
  }, [onUnlinked, setStatus, signOut]);

  const busy = unlink.kind === "in-progress";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>
        Signed in as <Text style={styles.bold}>{identifier}</Text>.
      </Text>
      <UpgradeStatusLine status={status} />
      {unlink.kind === "fail" ? (
        <Text style={styles.statusError} numberOfLines={4}>
          Could not unlink: {unlink.message}
        </Text>
      ) : null}
      <Pressable
        style={[styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={() => {
          void signOut();
        }}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={() => {
          void onUnlink();
        }}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.secondaryButtonText}>
            Unlink identity (keeps your data)
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const SignInPanel = ({
  onFlowError,
}: {
  onFlowError: (message: string) => void;
}) => {
  const { startSSOFlow } = useSSO();
  const signInHook = useSignIn();
  const signUpHook = useSignUp();
  const [flow, setFlow] = React.useState<CredentialFlow>({ stage: "choose" });

  const onOAuth = React.useCallback(
    async (strategy: OAuthStrategy) => {
      try {
        const result = await startSSOFlow({
          strategy,
          redirectUrl: Linking.createURL("/oauth-redirect"),
        });

        // Two paths produce a session: an existing user signs in (top-level
        // `createdSessionId`) or a new user signs up via the OAuth flow
        // (`signUp.createdSessionId`). The deprecated `useOAuth` only
        // surfaced the first; new users were silently dropped.
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
    setFlow({ stage: "identifier", channel, value: "", busy: false });
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
      // Successful verification flips Clerk's auth state; the parent
      // component re-renders with isSignedIn=true and triggers the
      // account-upgrade flow. No need to clear local state — this
      // component unmounts.
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
      <View style={styles.container}>
        <Text style={styles.title}>
          {flow.channel === "email"
            ? "Sign in with email"
            : "Sign in with phone"}
        </Text>
        <Text style={styles.body}>
          {flow.channel === "email"
            ? "Enter your email address. We'll send you a one-time code."
            : "Enter your phone number in international format (e.g. +14155550123). We'll send a code by SMS."}
        </Text>
        <TextInput
          style={styles.input}
          value={flow.value}
          onChangeText={(value) =>
            setFlow({ ...flow, value, error: undefined })
          }
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={
            flow.channel === "email" ? "email-address" : "phone-pad"
          }
          textContentType={
            flow.channel === "email" ? "emailAddress" : "telephoneNumber"
          }
          placeholder={
            flow.channel === "email" ? "you@example.com" : "+14155550123"
          }
          placeholderTextColor="#999"
          editable={!flow.busy}
          accessibilityLabel={
            flow.channel === "email" ? "Email address" : "Phone number"
          }
        />
        {flow.error ? (
          <Text style={styles.statusError}>{flow.error}</Text>
        ) : null}
        <Pressable
          style={[styles.primaryButton, flow.busy && styles.buttonDisabled]}
          onPress={() => {
            void submitIdentifier();
          }}
          disabled={flow.busy}
          accessibilityRole="button"
        >
          {flow.busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Send code</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setFlow({ stage: "choose" })}
          disabled={flow.busy}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (flow.stage === "code") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.body}>
          We sent a code to <Text style={styles.bold}>{flow.identifier}</Text>.
          Enter it below to finish signing in.
        </Text>
        <TextInput
          style={styles.input}
          value={flow.code}
          onChangeText={(code) => setFlow({ ...flow, code, error: undefined })}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          placeholder="123456"
          placeholderTextColor="#999"
          editable={!flow.busy}
          accessibilityLabel="Verification code"
        />
        {flow.error ? (
          <Text style={styles.statusError}>{flow.error}</Text>
        ) : null}
        <Pressable
          style={[styles.primaryButton, flow.busy && styles.buttonDisabled]}
          onPress={() => {
            void submitCode();
          }}
          disabled={flow.busy}
          accessibilityRole="button"
        >
          {flow.busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            setFlow({
              stage: "identifier",
              channel: flow.channel,
              value: flow.identifier,
              busy: false,
            })
          }
          disabled={flow.busy}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>
        Currently using nag with an anonymous account. Sign in to attach an
        identity, so you can install nag on a second device and keep your
        history.
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          void onOAuth("oauth_google");
        }}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Continue with Google</Text>
      </Pressable>
      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          void onOAuth("oauth_apple");
        }}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>Continue with Apple</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => startCredentialFlow("email")}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Continue with email</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => startCredentialFlow("phone")}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Continue with phone</Text>
      </Pressable>
    </View>
  );
};

type MaybeClerkError = {
  errors?: { code?: string; longMessage?: string; message?: string }[];
};

const clerkErrorCode = (err: unknown): string | undefined => {
  const e = err as MaybeClerkError;
  return e?.errors?.[0]?.code;
};

const clerkErrorMessage = (err: unknown): string | undefined => {
  const e = err as MaybeClerkError;
  return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message;
};

type ClerkSignIn = any;
type ClerkSignUp = any;
type ClerkSetActive = (params: { session: string }) => Promise<void>;

const prepareCredentialFlow = async ({
  channel,
  identifier,
  signIn,
  signUp,
}: {
  channel: CredentialChannel;
  identifier: string;
  signIn: ClerkSignIn;
  signUp: ClerkSignUp;
}): Promise<CredentialMode> => {
  const strategy = channel === "email" ? "email_code" : "phone_code";
  try {
    await signIn.create({ identifier });
    const factor = signIn.supportedFirstFactors?.find(
      (f: { strategy: string }) => f.strategy === strategy,
    );
    if (!factor) {
      throw new Error(
        `${strategy} is not enabled for this Clerk instance — enable it in the Clerk dashboard`,
      );
    }
    await signIn.prepareFirstFactor(factor);
    return "sign-in";
  } catch (err) {
    if (clerkErrorCode(err) === "form_identifier_not_found") {
      // No account yet — fall through to sign-up.
    } else {
      throw new Error(clerkErrorMessage(err) ?? (err as Error).message);
    }
  }

  if (channel === "email") {
    await signUp.create({ emailAddress: identifier });
    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  } else {
    await signUp.create({ phoneNumber: identifier });
    await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
  }
  return "sign-up";
};

const verifyCredentialCode = async ({
  channel,
  mode,
  code,
  signIn,
  signUp,
  setActive,
}: {
  channel: CredentialChannel;
  mode: CredentialMode;
  code: string;
  signIn: ClerkSignIn;
  signUp: ClerkSignUp;
  setActive: ClerkSetActive;
}): Promise<void> => {
  if (mode === "sign-in") {
    const strategy = channel === "email" ? "email_code" : "phone_code";
    const result = await signIn.attemptFirstFactor({ strategy, code });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error(`sign-in incomplete (status=${result.status})`);
    }
    await setActive({ session: result.createdSessionId });
    return;
  }

  const result =
    channel === "email"
      ? await signUp.attemptEmailAddressVerification({ code })
      : await signUp.attemptPhoneNumberVerification({ code });
  if (result.status !== "complete" || !result.createdSessionId) {
    const missing = result.missingFields ?? [];
    const reason =
      missing.length > 0
        ? `Clerk requires ${missing.join(", ")} — relax sign-up requirements in the Clerk dashboard`
        : `sign-up incomplete (status=${result.status})`;
    throw new Error(reason);
  }
  await setActive({ session: result.createdSessionId });
};

const requiredFieldMessage = (channel: CredentialChannel) =>
  channel === "email" ? "Enter your email address" : "Enter your phone number";

const UpgradeStatusLine = ({ status }: { status: UpgradeStatus }) => {
  switch (status.kind) {
    case "idle":
      return null;
    case "in-progress":
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator />
          <Text style={styles.statusText}>linking your account…</Text>
        </View>
      );
    case "ok":
      return <Text style={styles.statusOk}>Account linked.</Text>;
    case "fail":
      return (
        <Text style={styles.statusError} numberOfLines={4}>
          Could not link account: {status.message}
        </Text>
      );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
  },
  bold: {
    fontWeight: "600",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#999",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#999",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#222",
    backgroundColor: "#fafafa",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#666",
  },
  statusOk: {
    fontSize: 14,
    color: "#0a7d2c",
  },
  statusError: {
    fontSize: 14,
    color: "#c0392b",
  },
});
