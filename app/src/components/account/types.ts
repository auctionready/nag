export type UpgradeStatus =
  | { kind: "idle" }
  | { kind: "in-progress" }
  | { kind: "ok" }
  | { kind: "fail"; message: string };

export type CredentialChannel = "email" | "phone";
export type CredentialMode = "sign-in" | "sign-up";

export type CredentialFlow =
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

export type OAuthStrategy = "oauth_google" | "oauth_apple";

export type ConflictChoice = "cancel" | "use-server" | "use-device";

/**
 * The three outcomes of the sign-out confirmation prompt.
 *
 *   - `cancel` — keep the current signed-in state.
 *   - `keep-data` — sign out and keep local habits/check-ins on this
 *     device for offline use. Deletes the server-side account.
 *   - `wipe` — sign out and wipe every local trace (incl. `deviceId`)
 *     so the device returns to a fresh-install state. Leaves the
 *     server-side account alive so a subsequent sign-in can recover
 *     the data via `runPairFallback`.
 */
export type SignOutChoice = "cancel" | "keep-data" | "wipe";
