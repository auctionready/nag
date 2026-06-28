import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ensureDeviceRegistered, loadIdentity, setIdpSubject } from "@nag/core";
import { db } from "../../db";
import { registerDevice, upgradeAccount } from "../../infrastructure/apiClient";
import { log } from "../../infrastructure/log";
import { useSyncStatus } from "../../infrastructure/syncStatus";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { tokens } from "../theme";
import { runPairFallback } from "./conflictResolution";
import { confirmAndSignOut } from "./signOutAction";
import { SignedInView } from "./SignedInView";
import { SignInPanel } from "./SignInPanel";
import type { UpgradeStatus } from "./types";

const logger = log("account");

export const SignedInOrOut = () => {
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { user } = useUser();
  const { kickSync, drainOutbox } = useSyncStatus();
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
      // Functional updater is a no-op when status is already idle, so the
      // cascading-render concern doesn't apply here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

        // Skip the upgrade round-trip when this device is already bound to
        // the currently signed-in identity. The previous upgrade persisted
        // `idpSubject` on the local `identity` row; on cold start we just
        // verify it still matches Clerk's `user.id` and short-circuit.
        const persisted = await loadIdentity(db);
        if (
          persisted?.idpSubject &&
          user?.id &&
          persisted.idpSubject === user.id
        ) {
          logger.info(
            `account already upgraded for sub=${persisted.idpSubject} — skipping /accounts/upgrade`,
          );
          setStatus({ kind: "ok" });
          return;
        }

        const result = await upgradeAccount({ idpToken });
        Sentry.captureMessage(
          `nag.sync.sign-in-flow upgrade ${result.ok ? "ok" : result.kind}`,
          {
            level: result.ok ? "info" : "warning",
            contexts: {
              sync: result.ok
                ? { idpSubject: result.idpSubject }
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
          logger.info(`account upgraded sub=${result.idpSubject}`);
          await setIdpSubject(db, result.idpSubject);
          setStatus({ kind: "ok" });
          // Kick the sync loop now so the user sees their data immediately
          // rather than waiting on the safety timer (especially relevant
          // for devices where this is a fresh upgrade and pull-sync's
          // since=0 will fetch a snapshot).
          kickSync("post-upgrade");
          return;
        }

        // 409 here can mean only one thing now that sign-out is a hard
        // wipe of the local identity row: the verified Clerk sub
        // already owns another account elsewhere ("this identity is
        // already bound to a different account"). The other 409 — the
        // device's own account being bound to a stale identity —
        // can't happen anymore, because hard sign-out tears down the
        // device's local link to its previous server-side account.
        // Route every 409 to the existing pair-fallback.
        if (result.kind === "non-retriable" && result.status === 409) {
          logger.info(
            `upgrade conflicted (${result.message}) — falling back to pair-fallback`,
          );
          await runPairFallback({
            deviceId: registration.deviceId,
            idpToken,
            idpSubject: user?.id ?? null,
            kickSync,
            drainOutbox,
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
  }, [
    isLoaded,
    isSignedIn,
    user?.id,
    getToken,
    kickSync,
    drainOutbox,
    signOut,
  ]);

  // Sign-out is a confirmation dialog with two destructive choices —
  // "Keep on this device" (delete the server-side account, preserve
  // local data + outbox, replay outbox on next sign-in) and "Sign out
  // completely" (wipe every local row including `deviceId` so the
  // next launch is a fresh-install state). Both fix the takeover
  // vector that the previous soft sign-out left open. The kickSync
  // nudges SyncStatusProvider to re-evaluate immediately once the
  // signed-out state settles.
  const signOutLocal = React.useCallback(async () => {
    confirmAndSignOut(async () => {
      await signOut();
      kickSync("post-signout");
    });
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

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: tokens.cream,
    alignItems: "center",
    justifyContent: "center",
  },
});
