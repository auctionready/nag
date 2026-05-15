import React from "react";
import { Alert } from "react-native";
import {
  ensureDeviceRegistered,
  resetLocalAccount,
  setIdpSubject,
  switchLocalAccount,
} from "@nag/core";
import { habit } from "@nag/schema";
import { db } from "../../db";
import {
  pairDevice,
  registerDevice,
  releaseClerkIdentity,
  unbindAccount,
  unregisterDevice,
  upgradeAccount,
} from "../../infrastructure/apiClient";
import { log } from "../../infrastructure/log";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import type {
  ConflictChoice,
  IdentityMismatchChoice,
  UpgradeStatus,
} from "./types";

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
  signOut,
  setStatus,
  onCancelled,
}: {
  deviceId: string;
  idpToken: string;
  idpSubject: string | null;
  kickSync: (source: string) => void;
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
};

/**
 * "Use this device's data" path — take over the Clerk identity from
 * whatever account currently holds it and bind it to this device's
 * anonymous account. Two server calls in sequence: explicitly release
 * the existing binding, then bind on the caller. Local data is
 * preserved as-is; the existing outbox flushes the device's local
 * events to the server normally afterwards.
 */
export const runReplaceServer = async ({
  idpToken,
  kickSync,
  setStatus,
}: {
  idpToken: string;
  kickSync: (source: string) => void;
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
  logger.info("identity claimed onto local account — kicking sync");
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

/**
 * Handles the 409 case where this device's account is already bound to
 * a *different* identity than the one currently signing in (e.g. user
 * was Apple, signed out, signed in with Google on the same device).
 * Distinct from `runPairFallback`, which handles the inverse 409 — the
 * incoming identity is bound to a *different account* somewhere else.
 *
 *   - "Switch this account" → unbind the old identity (DELETE
 *     /accounts/me/identity) and rebind to the new one. The device's
 *     existing account survives, with its data and any other paired
 *     devices intact — only the login method changes.
 *   - "Start a new account" → unregister the device server-side (DELETE
 *     /devices/me, which cascades to a full account-delete if this was
 *     the last device), wipe the local mirror, then register fresh and
 *     bind the new identity to a brand-new account.
 *   - "Cancel" → signOut from Clerk; the device returns to its
 *     signed-out state with the original server-side binding untouched.
 */
export const runIdentityMismatch = async ({
  idpToken,
  kickSync,
  signOut,
  setStatus,
  onCancelled,
}: {
  idpToken: string;
  kickSync: (source: string) => void;
  signOut: () => Promise<void>;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
  onCancelled: () => void;
}): Promise<void> => {
  const choice = await chooseIdentityMismatch();
  if (choice === "cancel") {
    logger.info("identity mismatch cancelled by user — signing out of Clerk");
    try {
      await signOut();
    } catch (err) {
      logger.warn("signOut after identity-mismatch-cancel failed", err);
    }
    onCancelled();
    setStatus({ kind: "idle" });
    return;
  }

  if (choice === "switch") {
    await runSwitchIdentity({ idpToken, kickSync, setStatus });
    return;
  }

  await runStartNewAccount({ idpToken, kickSync, setStatus });
};

/**
 * "Switch this account to a new provider" — release the existing
 * identity binding on the calling account, then rebind it to the
 * verified token from the new provider. Two server calls in sequence;
 * the brief window between them leaves the account momentarily without
 * an `IdpSubject` server-side, but no other device's auth depends on
 * that field (device tokens sign `(accountId, deviceId)` directly).
 */
const runSwitchIdentity = async ({
  idpToken,
  kickSync,
  setStatus,
}: {
  idpToken: string;
  kickSync: (source: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
}): Promise<void> => {
  const unbound = await unbindAccount();
  if (!unbound.ok) {
    setStatus({ kind: "fail", message: unbound.message });
    return;
  }
  const claimed = await upgradeAccount({ idpToken });
  if (!claimed.ok) {
    setStatus({ kind: "fail", message: claimed.message });
    return;
  }
  await setIdpSubject(db, claimed.idpSubject);
  logger.info(
    `account rebound to new identity sub=${claimed.idpSubject} — kicking sync`,
  );
  setStatus({ kind: "ok" });
  kickSync("post-switch-identity");
};

/**
 * "Start a new account" — fully abandon the device's existing account
 * (unregister server-side; if this was the last device, the cascade
 * deletes the account row and its data), wipe every locally-replicated
 * row, then re-bootstrap with a fresh server account bound to the new
 * identity. Local data does **not** carry over — the user explicitly
 * chose to start fresh.
 */
const runStartNewAccount = async ({
  idpToken,
  kickSync,
  setStatus,
}: {
  idpToken: string;
  kickSync: (source: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<UpgradeStatus>>;
}): Promise<void> => {
  const unregistered = await unregisterDevice();
  // 401 here means the device-token side has already been invalidated
  // (e.g. a previous attempt cascaded the account and this is a retry).
  // Either way the server-side cleanup we wanted has happened — proceed
  // with the local wipe and re-bootstrap rather than surfacing a
  // confusing "unauthorized" error.
  if (
    !unregistered.ok &&
    !(unregistered.kind === "non-retriable" && unregistered.status === 401)
  ) {
    setStatus({ kind: "fail", message: unregistered.message });
    return;
  }

  await resetLocalAccount({ db, tokenStore: deviceTokenStore, log: logger });

  const registration = await ensureDeviceRegistered({
    db,
    tokenStore: deviceTokenStore,
    register: registerDevice,
    log: logger,
  });
  if (!registration.accountId) {
    setStatus({
      kind: "fail",
      message: "device re-registration failed — try again",
    });
    return;
  }

  const upgraded = await upgradeAccount({ idpToken });
  if (!upgraded.ok) {
    setStatus({ kind: "fail", message: upgraded.message });
    return;
  }
  await setIdpSubject(db, upgraded.idpSubject);
  logger.info(
    `started new account ${registration.accountId} bound to sub=${upgraded.idpSubject}`,
  );
  setStatus({ kind: "ok" });
  kickSync("post-fresh-account");
};

const chooseIdentityMismatch = (): Promise<IdentityMismatchChoice> =>
  new Promise((resolve) => {
    Alert.alert(
      "This device is signed in to another account",
      "Your data on this device belongs to an account linked to a different login. What would you like to do?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve("cancel"),
        },
        {
          text: "Switch this account to this login",
          onPress: () => resolve("switch"),
        },
        {
          text: "Start a new account",
          style: "destructive",
          onPress: () => resolve("fresh"),
        },
      ],
      { cancelable: true, onDismiss: () => resolve("cancel") },
    );
  });
