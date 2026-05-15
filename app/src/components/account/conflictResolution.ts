import React from "react";
import { Alert } from "react-native";
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
import type { ConflictChoice, UpgradeStatus } from "./types";

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
