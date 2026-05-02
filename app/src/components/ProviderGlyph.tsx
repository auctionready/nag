import Svg, { Path, Rect } from "react-native-svg";

/**
 * The Clerk providers we surface in the account UI. Each maps to a
 * concrete sign-in flow we support. iCloud and GitHub aren't wired up
 * server-side yet — they're declared here so the linked-state badge
 * renders correctly if a Clerk instance happens to expose them.
 */
export type ProviderKey =
  | "apple"
  | "google"
  | "email"
  | "phone"
  | "github"
  | "icloud";

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  apple: "Apple",
  google: "Google",
  email: "Email",
  phone: "Phone",
  github: "GitHub",
  icloud: "iCloud",
};

/**
 * Maps a Clerk `externalAccount.provider` (e.g. "oauth_apple") or a
 * verification strategy ("email_code", "phone_code") to the local
 * provider key. Returns null if the source is unknown.
 */
export const providerFromClerk = (
  raw: string | undefined,
): ProviderKey | null => {
  if (!raw) return null;
  if (raw === "oauth_apple" || raw === "apple") return "apple";
  if (raw === "oauth_google" || raw === "google") return "google";
  if (raw === "oauth_github" || raw === "github") return "github";
  if (raw === "oauth_apple_icloud" || raw === "icloud") return "icloud";
  if (raw.startsWith("email")) return "email";
  if (raw.startsWith("phone")) return "phone";
  return null;
};

interface ProviderGlyphProps {
  provider: ProviderKey;
  size?: number;
  color?: string;
  /** When true, render the brand-coloured Google "G" instead of mono. */
  branded?: boolean;
}

export const ProviderGlyph = ({
  provider,
  size = 16,
  color = "currentColor",
  branded = false,
}: ProviderGlyphProps) => {
  switch (provider) {
    case "apple":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9s-2-.9-3.3-.9c-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.7 1.2 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8 2.3-1.2 3.1-2.5c1-1.4 1.4-2.8 1.5-2.9-.1 0-2.9-1.1-2.9-4.4zM14 4.6c.7-.8 1.2-2 1-3.2-1 .1-2.3.7-3 1.5-.6.7-1.2 2-1 3.1 1.1.1 2.3-.6 3-1.4z" />
        </Svg>
      );
    case "google":
      if (branded) {
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
              fill="#4285F4"
              d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.8z"
            />
            <Path
              fill="#34A853"
              d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.9 0-5.3-2-6.2-4.6H2.2v2.9C4 20.4 7.7 23 12 23z"
            />
            <Path
              fill="#FBBC05"
              d="M5.7 14c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5l3.5-3z"
            />
            <Path
              fill="#EA4335"
              d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.2 15 1 12 1 7.7 1 4 3.6 2.2 7l3.5 2.9C6.7 7.4 9 5.4 12 5.4z"
            />
          </Svg>
        );
      }
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.8zM12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.9 0-5.3-2-6.2-4.6H2.2v2.9C4 20.4 7.7 23 12 23z" />
        </Svg>
      );
    case "github":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M12 1C5.9 1 1 5.9 1 12c0 4.9 3.2 9 7.5 10.5.5.1.7-.2.7-.5v-1.9c-3 .7-3.7-1.4-3.7-1.4-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.4-.3-4.9-1.2-4.9-5.4 0-1.2.4-2.2 1.1-2.9-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1.9-.2 1.8-.4 2.7-.4s1.9.1 2.7.4c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.7 1.1 1.7 1.1 2.9 0 4.2-2.5 5.1-4.9 5.4.4.3.8 1 .8 2v3c0 .3.2.6.7.5C19.8 21 23 16.9 23 12c0-6.1-4.9-11-11-11z" />
        </Svg>
      );
    case "icloud":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <Path d="M18.4 10.4c-.1-3-2.6-5.4-5.6-5.4-2.2 0-4.1 1.3-5 3.2-.5-.2-1-.3-1.6-.3-2.1 0-3.8 1.6-4 3.6C.6 11.8 0 12.8 0 14c0 1.7 1.3 3 3 3h15c1.7 0 3-1.3 3-3 0-1.6-1.1-2.9-2.6-3.6z" />
        </Svg>
      );
    case "email":
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Rect x={3} y={5} width={18} height={14} rx={2} />
          <Path d="M3 7l9 6 9-6" />
        </Svg>
      );
    case "phone":
      return (
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M5 4c0-.5.5-1 1-1h3l2 5-2 1c1 2 3 4 5 5l1-2 5 2v3c0 .5-.5 1-1 1-9 0-15-6-15-14z" />
        </Svg>
      );
  }
};
