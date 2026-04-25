import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useAuth, useSSO, useUser } from "@clerk/clerk-expo";
import { loadIdentity } from "@nag/core";
import { db } from "../db";
import { upgradeAccount } from "../infrastructure/apiClient";
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
  const { startSSOFlow } = useSSO();
  const [status, setStatus] = React.useState<UpgradeStatus>({ kind: "idle" });

  // Reset upgrade state on sign-out so a subsequent sign-in re-runs upgrade.
  React.useEffect(() => {
    if (isLoaded && !isSignedIn && status.kind !== "idle") {
      setStatus({ kind: "idle" });
    }
  }, [isLoaded, isSignedIn, status.kind]);

  // After a fresh sign-in, post the Clerk JWT to /accounts/upgrade exactly
  // once. The server is idempotent if the user re-signs-in to the same
  // identity, so retries on transient failure are safe.
  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || status.kind !== "idle") return;
    let cancelled = false;
    (async () => {
      setStatus({ kind: "in-progress" });
      try {
        const identity = await loadIdentity(db);
        if (!identity) {
          if (!cancelled)
            setStatus({
              kind: "fail",
              message: "no local device identity — restart the app",
            });
          return;
        }
        const idpToken = await getToken();
        if (!idpToken) {
          if (!cancelled)
            setStatus({ kind: "fail", message: "no IdP token from Clerk" });
          return;
        }
        const result = await upgradeAccount({
          deviceId: identity.deviceId,
          idpToken,
        });
        if (cancelled) return;
        if (result.ok) {
          logger.info(
            `account upgraded accountId=${result.accountId} sub=${result.idpSubject}`,
          );
          setStatus({ kind: "ok" });
        } else {
          setStatus({ kind: "fail", message: result.message });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        logger.error("upgrade flow threw", err);
        setStatus({ kind: "fail", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, status.kind]);

  const onSignIn = React.useCallback(async () => {
    try {
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/oauth-redirect"),
      });

      // Two paths produce a session: an existing user signs in (top-level
      // `createdSessionId`) or a new user signs up via the OAuth flow
      // (`signUp.createdSessionId`). The deprecated `useOAuth` only
      // surfaced the first; new Google users were silently dropped.
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
        `SSO completed without a session — signIn.status=${result.signIn?.status} signUp.status=${result.signUp?.status} missing=${JSON.stringify(missing)} unverified=${JSON.stringify(unverified)}`,
      );
      const reason =
        missing.length > 0
          ? `Clerk requires ${missing.join(", ")} — relax sign-up requirements in the Clerk dashboard`
          : "sign-in completed but no session was created";
      setStatus({ kind: "fail", message: reason });
    } catch (err) {
      logger.error("SSO flow threw", err);
      setStatus({
        kind: "fail",
        message: err instanceof Error ? err.message : "sign-in failed",
      });
    }
  }, [startSSOFlow]);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
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
            void onSignIn();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Continue with Google</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>
        Signed in as{" "}
        <Text style={styles.bold}>
          {user?.primaryEmailAddress?.emailAddress ?? user?.id ?? "unknown"}
        </Text>
        .
      </Text>
      <UpgradeStatusLine status={status} />
      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void signOut();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
    </View>
  );
};

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
