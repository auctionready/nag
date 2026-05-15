import { Alert, DevSettings } from "react-native";
import { disconnectFromCloud } from "@nag/core";
import { db } from "../../db";
import { deleteAccount } from "../../infrastructure/apiClient";
import { clearAllClerkTokens } from "../../infrastructure/clerk";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { log } from "../../infrastructure/log";

const logger = log("account:disconnect");

/**
 * "Disconnect from cloud" — DELETE the calling account on the server
 * (which cascades and removes events/devices/read models) and then
 * scrub *only* the local identity binding + sync cursor, leaving the
 * user's habits, goals, schedules, check-ins, and pending outbox rows
 * in place. The device transitions to local-only mode, exactly as if
 * it had never contacted the server, except with the user's data
 * already populated. A future sign-in registers a fresh account and
 * the outbox flushes existing data into it.
 *
 * Two-stage confirm because the server-side delete is still
 * irreversible — the only thing this preserves vs. `Delete account`
 * is the local mirror.
 */
export const confirmAndDisconnectFromCloud = () => {
  Alert.alert(
    "Disconnect from cloud",
    "Delete your account from the server but keep your habits and " +
      "check-ins on this device. You can keep using the app offline, " +
      "and sign in again later to start a new account. The server-side " +
      "delete cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          const result = await deleteAccount();
          if (!result.ok) {
            logger.error("server delete failed", result);
            Alert.alert(
              "Disconnect failed",
              `${result.kind === "non-retriable" ? `HTTP ${result.status}: ` : ""}${result.message}`,
            );
            return;
          }
          logger.info("server account deleted — clearing local binding");
          await disconnectFromCloud({
            db,
            tokenStore: deviceTokenStore,
            log: logger,
          });
          await clearAllClerkTokens();
          if (__DEV__) {
            DevSettings.reload();
            return;
          }
          Alert.alert(
            "Disconnected",
            "Your habits are still on this device. Sign in again to start syncing to a new account.",
          );
        },
      },
    ],
  );
};
