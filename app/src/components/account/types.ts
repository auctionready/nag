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
 * The three outcomes of the "this device's account is bound to a
 * different identity than the one signing in" prompt.
 *
 *   - `cancel` — sign out of Clerk; the device stays locally signed-out
 *     and the original identity binding on the server is untouched.
 *   - `switch` — atomically re-point the device's existing account at
 *     the new identity (DELETE then re-POST `/accounts/me/identity`).
 *     Local data and any other paired devices keep working.
 *   - `fresh` — abandon the existing account on this device (DELETE
 *     `/devices/me`, which cascades to a full account-delete if this
 *     was the last device), wipe local data, register a brand-new
 *     account, and bind it to the new identity.
 */
export type IdentityMismatchChoice = "cancel" | "switch" | "fresh";
