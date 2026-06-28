import * as Sentry from "@sentry/react-native";
export const navigationIntegration: ReturnType<
  typeof Sentry.reactNavigationIntegration
> = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: "https://08efe873f2d78ca522c637c112347142@o4511267724001280.ingest.de.sentry.io/4511267736649808",

  sendDefaultPii: false,

  enableLogs: true,

  // Session Replay is intentionally disabled: we don't capture screen
  // recordings (even masked) on errors. No replay integration, no replay
  // sampling.
  // Sample all traces in dev/preview so we can see startup bottlenecks; sample a
  // tenth of production traces to keep event volume reasonable.
  profilesSampleRate: 1.0,
  tracesSampleRate:
    __DEV__ || process.env.APP_VARIANT === "preview" ? 1.0 : 0.1,
  integrations: [Sentry.reactNativeTracingIntegration(), navigationIntegration],
  // Axios attaches request/response bodies and the `Authorization` header
  // to its error objects. `captureException` (called from our global
  // error handlers) would otherwise ship the live device bearer or a
  // Clerk `idpToken` along with the request/response payload to Sentry.
  // Duck-typed via `isAxiosError` to avoid pulling axios into the app's
  // direct deps (it's a transitive dep of `@nag/api-client`).
  beforeSend(event, hint) {
    const e = hint?.originalException as
      | {
          isAxiosError?: boolean;
          config?: {
            data?: unknown;
            headers?: Record<string, unknown>;
          };
          response?: { data?: unknown };
          request?: unknown;
        }
      | null
      | undefined;
    if (e?.isAxiosError === true) {
      if (e.config) {
        e.config.data = undefined;
        if (e.config.headers) {
          delete e.config.headers.Authorization;
          delete e.config.headers.authorization;
        }
      }
      if (e.response) {
        e.response.data = undefined;
      }
      e.request = undefined;
    }
    return event;
  },
});

export { Sentry };
