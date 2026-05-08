import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Sentry from "@sentry/react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import {
  useAuth,
  useSignIn,
  useSignUp,
  useSSO,
  useUser,
} from "@clerk/clerk-expo";
import {
  clearLocalAuth,
  ensureDeviceRegistered,
  switchLocalAccount,
} from "@nag/core";
import { habit } from "@nag/schema";
import { db } from "../../db";
import {
  pairDevice,
  registerDevice,
  upgradeAccount,
} from "../../infrastructure/apiClient";
import { isClerkConfigured } from "../../infrastructure/clerk";
import { log } from "../../infrastructure/log";
import { useSyncStatus } from "../../infrastructure/syncStatus";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { tokens } from "../../components/theme";
import { Group, ProviderButton, Row } from "../../components/account";
import {
  PROVIDER_LABELS,
  ProviderGlyph,
  type ProviderKey,
  providerFromClerk,
} from "../../components/glyphs";

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

const SignedInOrOut = () => {
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();
  const { kickSync } = useSyncStatus();
  const [status, setStatus] = React.useState<UpgradeStatus>({ kind: "idle" });

  // Tracks whether we've already kicked off an upgrade for the current
  // signed-in session. Reset when the user signs out. Using a ref instead
  // of `status.kind` as the guard avoids feedback loops: any `setStatus`
  // call inside the effect would otherwise change a dep, fire cleanup,
  // and silently cancel the pending API call.
  const upgradeStarted = React.useRef(false);

  React.useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      upgradeStarted.current = false;
      setStatus((current) =>
        current.kind === "idle" ? current : { kind: "idle" },
      );
      return;
    }

    if (upgradeStarted.current) return;
    upgradeStarted.current = true;

    void (async () => {
      Sentry.captureMessage("nag.sync.sign-in-flow start", {
        level: "info",
        tags: { area: "sync" },
      });
      setStatus({ kind: "in-progress" });
      try {
        const idpToken = await getToken();
        if (!idpToken) {
          Sentry.captureMessage("nag.sync.sign-in-flow no-idp-token", {
            level: "warning",
            tags: { area: "sync" },
          });
          setStatus({ kind: "fail", message: "no IdP token from Clerk" });
          return;
        }

        // Sign-in is the moment the app first contacts the server in the
        // anonymous-as-local model. Make sure the device is registered
        // (idempotent on `deviceId` — replays succeed) before the upgrade
        // call, which needs an existing Device row to bind to.
        const registration = await ensureDeviceRegistered({
          db,
          tokenStore: deviceTokenStore,
          register: registerDevice,
          log: logger,
        });
        Sentry.captureMessage("nag.sync.sign-in-flow ensureDeviceRegistered", {
          level: "info",
          contexts: {
            sync: {
              accountId: registration.accountId,
              deviceId: registration.deviceId,
              hasToken: registration.deviceToken != null,
            },
          },
          tags: { area: "sync" },
        });
        if (!registration.accountId) {
          setStatus({
            kind: "fail",
            message: "device registration failed — try again",
          });
          return;
        }

        const result = await upgradeAccount({
          deviceId: registration.deviceId,
          idpToken,
        });
        Sentry.captureMessage(
          `nag.sync.sign-in-flow upgrade ${result.ok ? "ok" : result.kind}`,
          {
            level: result.ok ? "info" : "warning",
            contexts: {
              sync: result.ok
                ? { accountId: result.accountId, idpSubject: result.idpSubject }
                : {
                    kind: result.kind,
                    status:
                      result.kind === "non-retriable"
                        ? result.status
                        : undefined,
                    message: result.message,
                  },
            },
            tags: { area: "sync" },
          },
        );
        if (result.ok) {
          logger.info(
            `account upgraded accountId=${result.accountId} sub=${result.idpSubject}`,
          );
          setStatus({ kind: "ok" });
          // Kick the sync loop now so the user sees their data immediately
          // rather than waiting on the safety timer (especially relevant
          // for devices where this is a fresh upgrade and pull-sync's
          // since=0 will fetch a snapshot).
          kickSync("post-upgrade");
          return;
        }

        // 409 = "this identity is already bound to a different account":
        // the user has signed in on this device with a Clerk identity that
        // already owns an account elsewhere. Fall back to the conflict
        // resolution flow (pair into the existing account, or
        // force-claim with this device's data).
        if (result.kind === "non-retriable" && result.status === 409) {
          logger.info(
            `upgrade conflicted (${result.message}) — falling back to conflict resolution`,
          );
          await runPairFallback({
            deviceId: registration.deviceId,
            idpToken,
            kickSync,
            signOut,
            setStatus,
            onCancelled: () => {
              upgradeStarted.current = false;
            },
          });
          return;
        }

        setStatus({ kind: "fail", message: result.message });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("upgrade flow threw", err);
        setStatus({ kind: "fail", message });
      }
    })();
  }, [isLoaded, isSignedIn, getToken, kickSync, signOut]);

  // Wrapping signOut so the local auth state is torn down *before* the
  // Clerk session ends. Order matters: clearing the secure-store token
  // and identity.accountId stops the dispatcher / pull-sync from
  // attempting another request under the dying credentials, and the
  // !isSignedIn effect above resets the rest of the React state
  // automatically once Clerk reports signed-out. Declared up here, ahead
  // of the early returns below, to keep the hook order stable across
  // renders. The trailing kickSync nudges SyncStatusProvider to
  // re-evaluate `isAnonymous` immediately so the sync dot disappears
  // without waiting on the next safety-timer tick.
  const signOutLocal = React.useCallback(async () => {
    try {
      await clearLocalAuth({ db, tokenStore: deviceTokenStore });
    } catch (err) {
      logger.error("clearLocalAuth threw — continuing with signOut", err);
    }
    kickSync("post-signout");
    await signOut();
  }, [signOut, kickSync]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={tokens.ink} />
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

  return <SignedInView user={user} status={status} signOut={signOutLocal} />;
};

/**
 * Handles the case where /accounts/upgrade returned 409 because the Clerk
 * identity is already bound to another account. The behaviour depends on
 * what's on this device:
 *
 *   - No local habits → silently pair into the existing account and let
 *     pull-sync hydrate the local DB. There's nothing to lose, so no
 *     prompt.
 *   - Local habits exist → ask the user to choose between replacing the
 *     local data with the server's, replacing the server's data with
 *     this device's (force-upgrade — the "use this device's data"
 *     flow), or cancelling the sign-in.
 */
const runPairFallback = async ({
  deviceId,
  idpToken,
  kickSync,
  signOut,
  setStatus,
  onCancelled,
}: {
  deviceId: string;
  idpToken: string;
  kickSync: (source: string) => void;
  signOut: () => Promise<void>;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onCancelled: () => void;
}): Promise<void> => {
  const localHabits = await db.select({ id: habit.id }).from(habit).limit(1);

  if (localHabits.length === 0) {
    await runReplaceLocal({ deviceId, idpToken, kickSync, setStatus });
    return;
  }

  const choice = await chooseConflictResolution();
  if (choice === "cancel") {
    logger.info("sign-in conflict cancelled by user — signing out of Clerk");
    try {
      await signOut();
    } catch (err) {
      logger.warn("signOut after sign-in-cancel failed", err);
    }
    onCancelled();
    setStatus({ kind: "idle" });
    return;
  }

  if (choice === "use-server") {
    await runReplaceLocal({ deviceId, idpToken, kickSync, setStatus });
    return;
  }

  await runReplaceServer({ deviceId, idpToken, kickSync, setStatus });
};

/**
 * "Use server data" path — pair this device into the existing account
 * and wipe local replicated tables so pull-sync rehydrates from the
 * server snapshot.
 */
const runReplaceLocal = async ({
  deviceId,
  idpToken,
  kickSync,
  setStatus,
}: {
  deviceId: string;
  idpToken: string;
  kickSync: (source: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
}): Promise<void> => {
  const paired = await pairDevice({ deviceId, idpToken });
  if (!paired.ok) {
    setStatus({ kind: "fail", message: paired.message });
    return;
  }

  await switchLocalAccount({
    db,
    tokenStore: deviceTokenStore,
    newAccountId: paired.accountId,
    newDeviceToken: paired.deviceToken,
    registeredAt: paired.registeredAt,
  });
  logger.info(
    `device paired into existing accountId=${paired.accountId} — local data wiped, kicking sync`,
  );
  setStatus({ kind: "ok" });
  kickSync("post-pair");
};

/**
 * "Use this device's data" path — force-upgrade this device's anonymous
 * account, which moves the Clerk identity from the other account onto
 * this one. Local data is preserved as-is; the existing outbox flushes
 * the device's local events to the server normally afterwards.
 */
const runReplaceServer = async ({
  deviceId,
  idpToken,
  kickSync,
  setStatus,
}: {
  deviceId: string;
  idpToken: string;
  kickSync: (source: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
}): Promise<void> => {
  const claimed = await upgradeAccount({ deviceId, idpToken, force: true });
  if (!claimed.ok) {
    setStatus({ kind: "fail", message: claimed.message });
    return;
  }
  logger.info(
    `identity force-claimed onto local accountId=${claimed.accountId} — kicking sync`,
  );
  setStatus({ kind: "ok" });
  kickSync("post-force-upgrade");
};

type ConflictChoice = "cancel" | "use-server" | "use-device";

const chooseConflictResolution = (): Promise<ConflictChoice> =>
  new Promise((resolve) => {
    Alert.alert(
      "You're already signed in elsewhere",
      "This account already has data on the server, and this device has habits of its own. Which copy should be kept?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve("cancel"),
        },
        {
          text: "Use server data",
          style: "destructive",
          onPress: () => resolve("use-server"),
        },
        {
          text: "Use this device's data",
          style: "destructive",
          onPress: () => resolve("use-device"),
        },
      ],
      { cancelable: true, onDismiss: () => resolve("cancel") },
    );
  });

const SignedInView = ({
  user,
  status,
  signOut,
}: {
  user: ReturnType<typeof useUser>["user"];
  status: UpgradeStatus;
  signOut: () => Promise<void>;
}) => {
  // Display info derived from Clerk's UserResource.
  const provider: ProviderKey =
    providerFromClerk(user?.externalAccounts?.[0]?.provider) ??
    (user?.primaryEmailAddress ? "email" : "phone");
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.primaryPhoneNumber?.phoneNumber ??
    "";
  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    email ||
    "Signed in";
  const initials = computeInitials(name);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.providerBadge}>
            <View style={styles.providerBadgeInner}>
              <ProviderGlyph
                provider={provider}
                size={12}
                color={tokens.cream}
              />
            </View>
          </View>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {email ? (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>

      {/* Stats strip — placeholders for now (streak / habits / this-mo) */}
      <View style={styles.statsStrip}>
        {[
          { v: "—", l: "streak" },
          { v: "—", l: "habits" },
          { v: "—", l: "this mo" },
        ].map((s) => (
          <View key={s.l} style={styles.statCell}>
            <Text style={styles.statValue}>{s.v}</Text>
            <Text style={styles.statLabel}>{s.l}</Text>
          </View>
        ))}
      </View>

      <UpgradeStatusLine status={status} />

      <Group title="Linked account">
        <Row
          icon={
            <ProviderGlyph provider={provider} size={14} color={tokens.ink} />
          }
          label={`Signed in with ${PROVIDER_LABELS[provider]}`}
          detail={email || undefined}
          chevron={false}
        />
        <Row
          icon={
            <Svg
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              stroke={tokens.orange}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M5 2L2 2L2 12L5 12" />
              <Path d="M9 4L12 7L9 10" />
              <Path d="M12 7L6 7" />
            </Svg>
          }
          label="Sign out"
          chevron={false}
          danger
          last
          onPress={() => void signOut()}
        />
      </Group>

      <SettingsGroups />

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

// Shared settings groups — visible whether or not the user is linked, since
// the rows are local-only features (habits, appearance, etc.) that don't
// require an account.
const SettingsGroups = () => (
  <>
    <Group title="Habits">
      <Row icon={iconGrid()} label="Manage habits" disabled />
      <Row icon={iconClock()} label="Reminders" disabled />
      <Row icon={iconExport()} label="Export data" last disabled />
    </Group>

    <Group title="App">
      <Row icon={iconAppearance()} label="Appearance" disabled />
      <Row icon={iconNag()} label="Tone of nags" disabled />
      <Row
        icon={iconAbout()}
        label="About"
        last
        onPress={() => router.navigate("/about")}
      />
    </Group>
  </>
);

const SignInPanel = ({
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

const SignInSheet = ({
  visible,
  onClose,
  onApple,
  onGoogle,
  onEmail,
  onPhone,
}: {
  visible: boolean;
  onClose: () => void;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
  onPhone: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View style={styles.sheetRoot}>
      <Pressable
        style={styles.sheetBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close sign-in sheet"
      />
      <View style={styles.sheet}>
        <View style={styles.sheetGrabber} />
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderText}>
            <Text style={styles.sheetEyebrow}>sign in</Text>
            <Text style={styles.sheetTitle}>back up &amp; sync</Text>
            <Text style={styles.sheetBody}>
              Your habits stay on this device until you sign in.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetClose,
              pressed && styles.sheetClosePressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Svg
              width={12}
              height={12}
              viewBox="0 0 12 12"
              fill="none"
              stroke={tokens.ink}
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <Path d="M2 2l8 8M10 2l-8 8" />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.providerStack}>
          <ProviderButton
            primary
            label="Continue with Apple"
            icon={
              <ProviderGlyph provider="apple" size={16} color={tokens.cream} />
            }
            onPress={onApple}
          />
          <ProviderButton
            label="Continue with Google"
            icon={<ProviderGlyph provider="google" size={16} />}
            onPress={onGoogle}
          />
          <ProviderButton
            label="Continue with Email"
            icon={
              <ProviderGlyph provider="email" size={16} color={tokens.ink} />
            }
            onPress={onEmail}
          />
          <ProviderButton
            label="Continue with Phone"
            icon={
              <ProviderGlyph provider="phone" size={16} color={tokens.ink} />
            }
            onPress={onPhone}
          />
        </View>

        <Text style={styles.disclaimer}>
          we never post or read your contacts.
        </Text>
      </View>
    </View>
  </Modal>
);

const CredentialIdentifierForm = ({
  flow,
  onChange,
  onSubmit,
  onBack,
}: {
  flow: Extract<CredentialFlow, { stage: "identifier" }>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) => (
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.scrollContent}
  >
    <View style={styles.formHeader}>
      <Text style={styles.formTitle}>
        {flow.channel === "email" ? "sign in with email" : "sign in with phone"}
      </Text>
      <Text style={styles.formBody}>
        {flow.channel === "email"
          ? "Enter your email address. We'll send a one-time code."
          : "Enter your phone number in international format (e.g. +14155550123). We'll send a code by SMS."}
      </Text>
    </View>
    <View style={styles.formCard}>
      <TextInput
        style={styles.input}
        value={flow.value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={flow.channel === "email" ? "email-address" : "phone-pad"}
        textContentType={
          flow.channel === "email" ? "emailAddress" : "telephoneNumber"
        }
        placeholder={
          flow.channel === "email" ? "you@example.com" : "+14155550123"
        }
        placeholderTextColor={tokens.mute}
        editable={!flow.busy}
        accessibilityLabel={
          flow.channel === "email" ? "Email address" : "Phone number"
        }
      />
      {flow.error && <Text style={styles.formError}>{flow.error}</Text>}
    </View>
    <View style={styles.formActions}>
      <ProviderButton
        primary
        label={flow.busy ? "Sending…" : "Send code"}
        icon={<View />}
        onPress={onSubmit}
        busy={flow.busy}
      />
      <ProviderButton
        label="Back"
        icon={<View />}
        onPress={onBack}
        disabled={flow.busy}
      />
    </View>
  </ScrollView>
);

const CredentialCodeForm = ({
  flow,
  onChange,
  onSubmit,
  onBack,
}: {
  flow: Extract<CredentialFlow, { stage: "code" }>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) => (
  <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.scrollContent}
  >
    <View style={styles.formHeader}>
      <Text style={styles.formTitle}>enter verification code</Text>
      <Text style={styles.formBody}>
        We sent a code to <Text style={styles.bold}>{flow.identifier}</Text>.
        Enter it below to finish signing in.
      </Text>
    </View>
    <View style={styles.formCard}>
      <TextInput
        style={styles.input}
        value={flow.code}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        placeholder="123456"
        placeholderTextColor={tokens.mute}
        editable={!flow.busy}
        accessibilityLabel="Verification code"
      />
      {flow.error && <Text style={styles.formError}>{flow.error}</Text>}
    </View>
    <View style={styles.formActions}>
      <ProviderButton
        primary
        label={flow.busy ? "Verifying…" : "Verify"}
        icon={<View />}
        onPress={onSubmit}
        busy={flow.busy}
      />
      <ProviderButton
        label="Back"
        icon={<View />}
        onPress={onBack}
        disabled={flow.busy}
      />
    </View>
  </ScrollView>
);

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
          <ActivityIndicator color={tokens.ink} />
          <Text style={styles.statusText}>linking your account…</Text>
        </View>
      );
    case "ok":
      return null;
    case "fail":
      return (
        <View style={styles.statusErrorBox}>
          <Text style={styles.statusErrorText} numberOfLines={4}>
            Could not link account: {status.message}
          </Text>
        </View>
      );
  }
};

const computeInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ── Inline icon factories for placeholder rows ───────────────────
const iconGrid = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
  >
    <Rect x={2} y={2} width={4} height={4} rx={1} />
    <Rect x={8} y={2} width={4} height={4} rx={1} />
    <Rect x={2} y={8} width={4} height={4} rx={1} />
    <Rect x={8} y={8} width={4} height={4} rx={1} />
  </Svg>
);
const iconClock = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={5} />
    <Path d="M7 4v3l2 2" />
  </Svg>
);
const iconExport = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 5h8M3 8h8M3 5v6h8V5" />
    <Path d="M5 2v3M9 2v3" />
  </Svg>
);
const iconAppearance = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={3} />
    <Path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" />
  </Svg>
);
const iconNag = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2 4h10M2 7h6M2 10h8" />
  </Svg>
);
const iconAbout = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={5} />
    <Path d="M7 6.5v3M7 4.5v.5" />
  </Svg>
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
  loadingScreen: {
    flex: 1,
    backgroundColor: tokens.cream,
    alignItems: "center",
    justifyContent: "center",
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
  // Profile header (signed in)
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(26,20,16,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: 0.4,
  },
  providerBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  providerBadgeInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  email: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
  },
  // Stats strip
  statsStrip: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 14,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  // Status / errors
  statusRow: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: tokens.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 13,
    color: tokens.mute,
  },
  statusErrorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,90,54,0.1)",
    borderRadius: 12,
  },
  statusErrorText: {
    fontSize: 13,
    color: tokens.orange,
  },
  // Unlinked CTA card (compact — opens sign-in sheet on tap)
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
  // Sign-in bottom sheet
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,7,4,0.42)",
  },
  sheet: {
    backgroundColor: tokens.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(26,20,16,0.14)",
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 4,
  },
  sheetEyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  sheetBody: {
    fontSize: 12.5,
    lineHeight: 17.5,
    color: tokens.mute,
    marginTop: 2,
    maxWidth: 260,
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(26,20,16,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetClosePressed: {
    opacity: 0.7,
  },
  providerStack: {
    gap: 8,
  },
  disclaimer: {
    paddingHorizontal: 8,
    paddingTop: 14,
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1,
    textAlign: "center",
  },
  // Credential forms (identifier / code)
  formHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  formBody: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.mute,
  },
  formCard: {
    marginHorizontal: 16,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    fontSize: 16,
    color: tokens.ink,
    paddingVertical: 12,
  },
  formError: {
    fontSize: 13,
    color: tokens.orange,
    paddingVertical: 6,
  },
  formActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  bold: {
    fontWeight: "600",
    color: tokens.ink,
  },
});
