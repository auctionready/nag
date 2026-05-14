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
