import * as Sentry from "@sentry/react-native";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export const registerNavigationContainer =
  navigationIntegration.registerNavigationContainer;

console.log("Initializing Sentry..."); // https://github.com/getsentry/sentry-react-native/issues/5508
Sentry.init({
  dsn: "https://08efe873f2d78ca522c637c112347142@o4511267724001280.ingest.de.sentry.io/4511267736649808",

  sendDefaultPii: true,

  enableLogs: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  profilesSampleRate: 1.0,
  tracesSampleRate:
    __DEV__ || process.env.APP_VARIANT === "preview" ? 1.0 : 0.1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.reactNativeTracingIntegration(),
    navigationIntegration,
  ],
});

export { Sentry };
