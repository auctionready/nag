import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DevSettings,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clearLocalAuth, loadIdentity } from "@nag/core";
import { ensureDevAuthRegistered } from "@nag/core/dev";
import { db } from "../../db";
import { fetchDevToken } from "../../infrastructure/devAuth";
import { getApiBaseUrl } from "../../infrastructure/devOverrides";
import { postCommitBus } from "../../infrastructure/postCommitBus";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { log } from "../../infrastructure/log";
import { tokens } from "../theme";
import { confirmAndDeleteAccount } from "./deleteAccountAction";

const logger = log("dev-auth:account");

export const DevAuthAccountPanel = () => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const row = await loadIdentity(db);
      setAccountId(row?.accountId ?? null);
      setLoaded(true);
    })();
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    const result = await ensureDevAuthRegistered({
      db,
      tokenStore: deviceTokenStore,
      fetchDevToken,
      log: logger,
    });
    if (!result.accountId) {
      setBusy(false);
      const detail =
        result.result && "kind" in result.result
          ? `${result.result.kind}: ${result.result.message}`
          : "see logs";
      Alert.alert("Dev sign-in failed", detail);
      return;
    }
    postCommitBus.emit();
    DevSettings.reload();
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await clearLocalAuth({ db, tokenStore: deviceTokenStore });
    } catch (err) {
      logger.error("clearLocalAuth threw", err);
    }
    DevSettings.reload();
  }, []);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.ink} />
      </View>
    );
  }

  if (accountId) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.body}>
          <Text style={styles.title}>signed in as dev user.</Text>
          <Text style={styles.subtitle}>
            account <Text style={styles.code}>{accountId}</Text> via
            <Text style={styles.code}> /dev/token</Text> at
            <Text style={styles.code}> {getApiBaseUrl()}</Text>. The same
            account is wired into Swagger UI. Use the dev menu to switch
            backend.
          </Text>
          <Pressable
            onPress={signOut}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              styles.neutralButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.neutralButtonText}>Sign out</Text>
          </Pressable>
          <Pressable
            onPress={confirmAndDeleteAccount}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              styles.destructiveButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.destructiveButtonText}>Delete account</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.body}>
        <Text style={styles.title}>signed out (dev-auth).</Text>
        <Text style={styles.subtitle}>
          Mint a local HMAC device token via
          <Text style={styles.code}> /dev/token</Text> against
          <Text style={styles.code}> {getApiBaseUrl()}</Text>. The same account
          is wired into Swagger UI.
        </Text>
        <Pressable
          onPress={signIn}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in as dev user</Text>
        </Pressable>
      </View>
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
  loading: {
    flex: 1,
    backgroundColor: tokens.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.mute,
  },
  code: {
    fontFamily: "JetBrainsMono",
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: tokens.ink,
  },
  primaryButtonText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "700",
    color: tokens.cream,
    letterSpacing: -0.07,
  },
  neutralButton: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  neutralButtonText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.07,
  },
  destructiveButton: {
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  destructiveButtonText: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "700",
    color: tokens.orange,
    letterSpacing: -0.07,
  },
});
