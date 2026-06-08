import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ConfigContext, ExpoConfig } from "expo/config";

// Expo's config loader is synchronous (it rejects a Promise-returning config),
// so we shell out to the fingerprint script and read the runtime version off
// stdout rather than awaiting it inline.
const computeRuntimeVersion = (): string =>
  execFileSync(
    process.execPath,
    [join(__dirname, "scripts/runtime-version.cjs")],
    {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  ).trim();

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const PROJECT_ID = "bc1ee86a-bc83-4f06-aa4f-d4f757d18e55";

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
  // Derived from Expo's fingerprint with pnpm virtual-store hashes stripped, so
  // a lockfile re-resolve doesn't churn the runtime version and silently break
  // OTA delivery. See scripts/runtime-version.cjs.
  runtimeVersion: computeRuntimeVersion(),
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
