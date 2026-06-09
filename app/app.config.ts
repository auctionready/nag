import { ConfigContext, ExpoConfig } from "expo/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const PROJECT_ID = "bc1ee86a-bc83-4f06-aa4f-d4f757d18e55";

// runtimeVersion is pinned from fingerprint.generated.json, produced by
// `scripts/generate-runtime-version.mjs` before `eas build` / `eas update`.
// Always a STRING so @expo/fingerprint's ExpoConfigRuntimeVersionIfString skip
// (fingerprint.config.cjs) strips it from its own hash — the value can never
// feed back into the fingerprint that produced it.
const runtimeVersion = (): string => {
  try {
    const file = join(process.cwd(), "fingerprint.generated.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      runtimeVersion?: string;
    };
    if (parsed.runtimeVersion) return parsed.runtimeVersion;
  } catch {
    // Not generated yet (e.g. local `expo start`). eas build/update must run the
    // generate script first — CI does; locally: `pnpm --filter @nag/app fingerprint`.
  }
  return "0.0.0-uncommitted";
};

const bundleId = () => {
  if (IS_DEV) return "com.auctionready.nag.app.dev";
  if (IS_PREVIEW) return "com.auctionready.nag.app.preview";
  return "com.auctionready.nag.app";
};

const appName = () => {
  if (IS_DEV) return "nag (Dev)";
  if (IS_PREVIEW) return "nag (Preview)";
  return "nag";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName(),
  slug: "nag",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "nag",
  runtimeVersion: runtimeVersion(),
  updates: {
    url: `https://u.expo.dev/${PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
  },
  ios: {
    ...config.ios,
    supportsTablet: true,
    bundleIdentifier: bundleId(),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    appleTeamId: "QNWX2YN6C5",
  },
  platforms: ["ios"],
  plugins: [
    "@react-native-community/datetimepicker",
    [
      "expo-notifications",
      {
        mode: IS_DEV ? "development" : "production",
      },
    ],
    "expo-router",
    "expo-sqlite",
    "expo-font",
    "expo-web-browser",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        imageWidth: 280,
        backgroundColor: "#FFF8F0",
      },
    ],
    [
      "@sentry/react-native",
      {
        url: "https://sentry.io/",
        project: "react-native",
        organization: "nag-stable",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: PROJECT_ID,
    },
    apiBaseUrl: process.env.NAG_API_BASE_URL ?? "",
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  },
  owner: "nag-stable",
  experiments: {
    typedRoutes: true,
  },
});
