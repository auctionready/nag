import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "nag",
  slug: "nag",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "nag",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "cover",
    backgroundColor: "#8b6545",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.auctionready.nag.app",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    appleTeamId: "QNWX2YN6C5",
  },
  platforms: ["ios"],
  plugins: [
    "@react-native-community/datetimepicker",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        resizeMode: "cover",
        backgroundColor: "#8b6545",
      },
    ],
    [
      "expo-notifications",
      {
        mode: "development",
      },
    ],
    "expo-router",
    "expo-sqlite",
  ],
  extra: {
    eas: {
      projectId: "bc1ee86a-bc83-4f06-aa4f-d4f757d18e55",
    },
  },
  owner: "nag-stable",
};

export default config;
