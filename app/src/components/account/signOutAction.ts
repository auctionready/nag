import { Alert } from "react-native";
import { disconnectFromCloud, pauseDispatch } from "@nag/core";
import { db } from "../../db";
import { deleteAccount } from "../../infrastructure/apiClient";
import { clearAllClerkTokens } from "../../infrastructure/clerk";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { log } from "../../infrastructure/log";

const logger = log("account:sign-out");

/**
 * Sign-out shows a three-option Alert. Cancel does nothing; the two
 * destructive options are NOT equivalent — they let the user pick
 * between a "I'm done with the cloud" exit and a "stop syncing for a
 * while, I'll be back" pause.
 *
 *   - **Remove server data and sign out.** `DELETE /accounts/me` on
 *     the server, then `disconnectFromCloud` locally (clear identity
 *     binding + token, reset syncState, re-mark sent outbox rows to
 *     pending), then `clerk.signOut()`. Habits/check-ins/outbox stay
 *     on the device. Re-signing-in later (any provider) creates a
 *     fresh server account that the outbox flushes into. This is
 *     the path that fully detaches from the cloud — the only one
 *     after which signing back in with a *different* provider works
 *     cleanly (no orphan server account on the old identity).
 *
 *   - **Pause server sync.** Sets `sync_state.paused = true` via
 *     `pauseDispatch`. Both the outbox dispatcher and pull-sync
 *     short-circuit on their next tick — nothing ships, nothing is
 *     pulled, the existing local + server state is preserved.
 *     **Does not sign out of Clerk** and does not touch any server
 *     state. Resume is via the "Sync paused" banner on the Account
 *     screen, which flushes the outbox backlog. The point: a calm
 *     "I want to think about this offline for a while" without
 *     burning the cloud relationship.
 *
 * The two-stage cleanup of the first branch (server delete → local
 * disconnect → Clerk sign-out) is sequential: a failed server delete
 * aborts before any local state is touched, so the device is left in
 * its original signed-in state with a surfaced error rather than a
 * half-applied teardown.
 */
export const confirmAndSignOut = (clerkSignOut: () => Promise<void>) => {
  Alert.alert(
    "Sign out",
    "Choose how to sign out of the cloud.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove server data and sign out",
        style: "destructive",
        onPress: () => runRemoveServerData(clerkSignOut),
      },
      {
        // Not labelled destructive — pause is a reversible action with
        // no data loss.
        text: "Pause server sync",
        onPress: () => runPause(),
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

const runRemoveServerData = async (clerkSignOut: () => Promise<void>) => {
  const result = await deleteAccount();
  if (!result.ok) {
    logger.error("server delete failed — surfacing error", result);
    Alert.alert(
      "Couldn't sign out cleanly",
      `${result.kind === "non-retriable" ? `HTTP ${result.status}: ` : ""}${result.message}`,
    );
    return;
  }
  logger.info(
    "server account deleted — clearing local binding, preserving local data",
  );
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

const runPause = async () => {
  logger.info(
    "pausing sync — server data + Clerk session left intact, resume via Account-screen banner",
  );
  await pauseDispatch(db);
  // Intentionally no Clerk signOut + no kickSync — pause means the
  // dispatcher should stop, not just defer. The Account screen's
  // SyncPausedBanner is the user's way back to a syncing state.
};
