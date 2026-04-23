import { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

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
  splash: {
    image: "./assets/donkey-splash.jpeg",
    resizeMode: "cover",
    backgroundColor: "#8b6545",
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
    ["@nag/icloud-backup"],
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "react-native",
        organization: "nag-stable",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "bc1ee86a-bc83-4f06-aa4f-d4f757d18e55",
    },
  },
  owner: "nag-stable",
});
