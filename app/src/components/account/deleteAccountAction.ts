import { Alert, DevSettings } from "react-native";
import { deleteAccount } from "../../infrastructure/apiClient";
import { clearAllClerkTokens } from "../../infrastructure/clerk";
import { deviceTokenStore } from "../../infrastructure/tokenStore";
import { resetDatabaseSchema } from "../../db";
import { log } from "../../infrastructure/log";

const logger = log("account:delete");

// Two-stage confirm because this is irreversible: the server hard-deletes
// events, devices, read models, and the account row, and we then wipe local
// SQLite + tokens so the next launch is a fresh first-install. The current
// device token is what the API uses to identify the caller, so the delete
// itself must run *before* we clear the token store.
export const confirmAndDeleteAccount = () => {
  Alert.alert(
    "Delete account",
    "This permanently deletes your account and all habit/check-in data " +
      "from the server. Local data on this device will also be wiped. " +
      "There is no undo.",
    [
      { text: "Keep my account", style: "cancel" },
      {
        text: "Delete forever",
        style: "destructive",
        onPress: async () => {
          const result = await deleteAccount();
          if (!result.ok) {
            logger.error("delete failed", result);
            Alert.alert(
              "Delete failed",
              `${result.kind === "non-retriable" ? `HTTP ${result.status}: ` : ""}${result.message}`,
            );
            return;
          }
          logger.info(
            `server account deleted (${result.accountId}) — wiping local state`,
          );
          await deviceTokenStore.clear();
          await clearAllClerkTokens();
          resetDatabaseSchema();
          if (__DEV__) {
            DevSettings.reload();
            return;
          }
          Alert.alert(
            "Account deleted",
            "Your account and local data have been removed. Please close and reopen the app.",
          );
        },
      },
    ],
  );
};
