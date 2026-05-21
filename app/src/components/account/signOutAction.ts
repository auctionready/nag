import { Alert } from "react-native";
import { disconnectFromCloud, resetLocalAccount } from "@nag/core";
import { db } from "../../db";
import { deleteAccount } from "../../infrastructure/apiClient";
import { clearAllClerkTokens } from "../../infrastructure/clerk";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { log } from "../../infrastructure/log";
import type { SignOutChoice } from "./types";

const logger = log("account:sign-out");

/**
 * Sign-out has two destructive intents the user picks between:
 *
 *   - **Keep my data on this device** — delete the server-side account
 *     (`DELETE /accounts/me`) but leave habits/check-ins/outbox on
 *     the device so the app keeps working offline. Re-signing-in later
 *     creates a fresh server account that the queued outbox events
 *     flush into.
 *   - **Sign out completely** — wipe every local replicated row + the
 *     entire `identity` row (including `deviceId`). Server-side account
 *     is left intact so it can be recovered via a same-identity
 *     sign-in (`runPairFallback` re-pairs the fresh device into it).
 *
 * Either choice ends the Clerk session and clears the local device
 * token. Both also break the takeover vector that motivated this
 * design: the first by deleting the server-side account row that the
 * device token authenticates against, the second by minting a fresh
 * `deviceId` on the next launch so the previous server-side row can
 * never be re-claimed.
 *
 * The two-stage `Alert` matches the destructive nature: an initial
 * three-choice prompt picks an intent, then each destructive branch
 * runs without a second confirm. Cancel keeps everything as-is.
 */
export const confirmAndSignOut = (clerkSignOut: () => Promise<void>) => {
  Alert.alert(
    "Sign out",
    "What should happen to the habits and check-ins on this device?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Keep on this device",
        // The handler returns Promise<void>. React Native's onPress
        // signature is `() => void`, but `void` is permissive — TS
        // accepts any return type — and RN silently discards the
        // resolved value at runtime. Returning the promise lets unit
        // tests await the actual server + local cleanup.
        onPress: () => runKeepData(clerkSignOut),
      },
      {
        text: "Sign out completely",
        style: "destructive",
        onPress: () => runWipe(clerkSignOut),
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        /* no-op — same as Cancel */
      },
    },
  );
};

const runKeepData = async (clerkSignOut: () => Promise<void>) => {
  const result = await deleteAccount();
  if (!result.ok) {
    logger.error("server delete failed — surfacing error", result);
    Alert.alert(
      "Couldn't sign out cleanly",
      `${result.kind === "non-retriable" ? `HTTP ${result.status}: ` : ""}${result.message}`,
    );
    return;
  }
  logger.info("server account deleted — clearing local binding (keeping data)");
  await disconnectFromCloud({
    db,
    tokenStore: deviceTokenStore,
    log: logger,
  });
  await clearAllClerkTokens();
  try {
    await clerkSignOut();
  } catch (err) {
    logger.warn("clerk signOut threw — local state already cleared", err);
  }
};

const runWipe = async (clerkSignOut: () => Promise<void>) => {
  logger.info("wiping local state — server account left intact for recovery");
  await resetLocalAccount({
    db,
    tokenStore: deviceTokenStore,
    log: logger,
  });
  await clearAllClerkTokens();
  try {
    await clerkSignOut();
  } catch (err) {
    logger.warn("clerk signOut threw — local state already cleared", err);
  }
};

// Exposed so callers (e.g. the SignedInView) can refer to the same
// choice values the dialog hands back if they need to label affordances.
export const SIGN_OUT_CHOICES: readonly SignOutChoice[] = [
  "cancel",
  "keep-data",
  "wipe",
];
