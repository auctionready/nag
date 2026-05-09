import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { log } from "./log";

export type AuthMode = "dev-auth" | "clerk";

export type BackendOverride = {
  apiBaseUrl: string;
  authMode: AuthMode;
};

type Extra = {
  apiBaseUrl?: string;
};

const URL_KEY = "nag.devOverride.apiBaseUrl";
const MODE_KEY = "nag.devOverride.authMode";

const logger = log("devOverrides");

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

/**
 * Auth-mode default before any SecureStore override is applied. In
 * `__DEV__` builds we default to dev-auth so a fresh `pnpm expo start`
 * against a local backend "just works" without a Clerk sign-in;
 * `EXPO_PUBLIC_NAG_DEV_AUTH=0` opts back into the Clerk flow (typical
 * for cloud-apidev testing). In production builds the flag is ignored
 * and we hard-return `"clerk"`.
 */
const envAuthMode = (): AuthMode => {
  if (!__DEV__) return "clerk";
  const flag = process.env.EXPO_PUBLIC_NAG_DEV_AUTH;
  if (flag === "0") return "clerk";
  if (flag === "1") return "dev-auth";
  return "dev-auth";
};

const envApiBaseUrl = (): string => extra().apiBaseUrl ?? "";

let loaded = false;
let resolvedAuthMode: AuthMode = envAuthMode();
let resolvedApiBaseUrl: string = envApiBaseUrl();

const isAuthMode = (s: unknown): s is AuthMode =>
  s === "dev-auth" || s === "clerk";

/**
 * One-shot loader that reads the dev-menu overrides out of SecureStore
 * and resolves the session's `authMode` + `apiBaseUrl` constants. Must
 * be awaited before the React tree mounts so api-client construction
 * (`getApiClient` in `apiClient.ts`) and `<ClerkOrPassthrough>` see the
 * final values. Runs once; subsequent calls are no-ops.
 *
 * In production builds the overrides are ignored — `getAuthMode` and
 * `getApiBaseUrl` hard-return the env values. SecureStore reads are
 * skipped entirely so a maliciously-planted entry can't take effect on
 * a release client.
 */
export const bootstrapDevOverrides = async (): Promise<void> => {
  if (loaded) return;
  if (!__DEV__) {
    loaded = true;
    return;
  }
  try {
    const [storedUrl, storedMode] = await Promise.all([
      SecureStore.getItemAsync(URL_KEY),
      SecureStore.getItemAsync(MODE_KEY),
    ]);
    if (storedUrl) resolvedApiBaseUrl = storedUrl;
    if (isAuthMode(storedMode)) resolvedAuthMode = storedMode;
    if (storedUrl || storedMode) {
      logger.info(
        `override active apiBaseUrl=${resolvedApiBaseUrl} authMode=${resolvedAuthMode}`,
      );
    }
  } catch (error: unknown) {
    logger.warn("SecureStore read failed; falling back to env", error);
  }
  loaded = true;
};

/**
 * Resolved auth mode for this session. Read after `bootstrapDevOverrides`
 * resolves; before that, callers see the env-derived default.
 */
export const getAuthMode = (): AuthMode => resolvedAuthMode;

/**
 * Resolved API base URL for this session. Read after
 * `bootstrapDevOverrides` resolves; before that, callers see the env
 * value from `app.config.ts`'s `extra.apiBaseUrl`.
 */
export const getApiBaseUrl = (): string => resolvedApiBaseUrl;

/**
 * Persists a new backend override. Caller is responsible for the
 * follow-up DB/secure-store wipe and `DevSettings.reload()` — this just
 * writes the SecureStore entries.
 */
export const setBackendOverride = async (
  override: BackendOverride,
): Promise<void> => {
  await Promise.all([
    SecureStore.setItemAsync(URL_KEY, override.apiBaseUrl),
    SecureStore.setItemAsync(MODE_KEY, override.authMode),
  ]);
  logger.info(
    `override set apiBaseUrl=${override.apiBaseUrl} authMode=${override.authMode}`,
  );
};

/**
 * Removes any persisted override; the next `bootstrapDevOverrides` call
 * will resolve back to env defaults.
 */
export const clearBackendOverride = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(URL_KEY),
    SecureStore.deleteItemAsync(MODE_KEY),
  ]);
  logger.info("override cleared — env defaults will apply on next reload");
};
