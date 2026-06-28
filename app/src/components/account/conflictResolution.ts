import React from "react";
import { Alert } from "react-native";
import * as Sentry from "@sentry/react-native";
import { setIdpSubject, switchLocalAccount } from "@nag/core";
import { habit } from "@nag/schema";
import { db } from "../../db";
import {
  pairDevice,
  releaseClerkIdentity,
  upgradeAccount,
} from "../../infrastructure/apiClient";
import { log } from "../../infrastructure/log";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import type { DrainOutboxStatus } from "../../infrastructure/syncStatus";
import type { ConflictChoice, UpgradeStatus } from "./types";

// How long to wait after pairing into an existing account before warning that
// the local DB is still empty — a rough upper bound on one push+pull
// round-trip. If nothing has landed by then it almost certainly isn't coming.
const EMPTY_SNAPSHOT_PROBE_MS = 10_000;

const logger = log("account");

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
export const runPairFallback = async ({
  deviceId,
  idpToken,
  idpSubject,
  kickSync,
  drainOutbox,
  signOut,
  setStatus,
  onCancelled,
}: {
  deviceId: string;
  idpToken: string;
  idpSubject: string | null;
  kickSync: (source: string) => void;
  drainOutbox: () => Promise<DrainOutboxStatus>;
  signOut: () => Promise<void>;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onCancelled: () => void;
}): Promise<void> => {
  const localHabits = await db.select({ id: habit.id }).from(habit).limit(1);

  if (localHabits.length === 0) {
    await runReplaceLocal({
      deviceId,
      idpToken,
      idpSubject,
      kickSync,
      setStatus,
    });
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
    await runReplaceLocal({
      deviceId,
      idpToken,
      idpSubject,
      kickSync,
      setStatus,
    });
    return;
  }

  await runReplaceServer({
    idpToken,
    kickSync,
    drainOutbox,
    setStatus,
  });
};

/**
 * "Use server data" path — pair this device into the existing account
 * and wipe local replicated tables so pull-sync rehydrates from the
 * server snapshot.
 */
export const runReplaceLocal = async ({
  deviceId,
  idpToken,
  idpSubject,
  kickSync,
  setStatus,
}: {
  deviceId: string;
  idpToken: string;
  idpSubject: string | null;
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
  if (idpSubject) await setIdpSubject(db, idpSubject);
  logger.info(
    `device paired into existing accountId=${paired.accountId} — local data wiped, kicking sync`,
  );
  setStatus({ kind: "ok" });
  kickSync("post-pair");

  // Observability for "paired but the board is still empty" — the mirror
  // image of the take-over race this change fixes: if the *other* device's
  // upgrade shipped before the outbox-drain fix, the just-claimed account
  // can be empty on the server, so pull-sync hydrates nothing. Without this
  // signal it looks like a silent client bug.
  setTimeout(() => {
    void (async () => {
      try {
        const rows = await db.select({ id: habit.id }).from(habit).limit(1);
        if (rows.length === 0) {
          logger.warn(
            `paired into accountId=${paired.accountId} but local DB still empty after ${EMPTY_SNAPSHOT_PROBE_MS}ms — server snapshot was empty`,
          );
          Sentry.captureMessage(
            "second-device pair: empty server snapshot",
            "warning",
          );
        }
      } catch (err) {
        logger.warn("post-pair empty-snapshot probe threw", err);
      }
    })();
  }, EMPTY_SNAPSHOT_PROBE_MS);
};

/**
 * "Use this device's data" path — take over the Clerk identity from
 * whatever account currently holds it and bind it to this device's
 * anonymous account. Two server calls in sequence: explicitly release
 * the existing binding, then bind on the caller. Local data is preserved
 * as-is, then the outbox is **drained inline** so this device's events are
 * canonical on the server *before* we report success — otherwise the user
 * could sign in on a second device immediately and pull an empty snapshot
 * from the just-claimed account, because the events hadn't finished
 * uploading yet.
 */
export const runReplaceServer = async ({
  idpToken,
  kickSync,
  drainOutbox,
  setStatus,
}: {
  idpToken: string;
  kickSync: (source: string) => void;
  drainOutbox: () => Promise<DrainOutboxStatus>;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
}): Promise<void> => {
  const released = await releaseClerkIdentity({ idpToken });
  if (!released.ok) {
    setStatus({ kind: "fail", message: released.message });
    return;
  }
  const claimed = await upgradeAccount({ idpToken });
  if (!claimed.ok) {
    setStatus({ kind: "fail", message: claimed.message });
    return;
  }
  await setIdpSubject(db, claimed.idpSubject);

  logger.info("identity claimed onto local account — draining outbox");
  const drain = await drainOutbox();
  if (drain === "halted" || drain === "paused") {
    setStatus({
      kind: "fail",
      message:
        "couldn't upload your data — open the sync panel and tap Resume to retry",
    });
    return;
  }
  if (drain === "offline") {
    setStatus({
      kind: "fail",
      message:
        "couldn't upload your data — check your connection and try again",
    });
    return;
  }
  // "anonymous"/"disabled" shouldn't be reachable here — we just bound an
  // identity and the API is configured — but treat them as success and let
  // kickSync recover if the dispatcher gating disagrees.
  logger.info(`outbox drained (${drain}) — kicking pull-sync`);
  setStatus({ kind: "ok" });
  kickSync("post-take-over");
};

export const chooseConflictResolution = (): Promise<ConflictChoice> =>
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
