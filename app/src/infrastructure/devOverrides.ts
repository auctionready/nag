import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { log } from "./log";

export type AuthMode = "dev-auth" | "clerk";

// Named dev-menu backends. The dev menu persists the chosen name (not
// the URL) in SecureStore so that, when the URL behind a name changes,
// the device picks it up on the next reload without needing a wipe.
export type BackendName = "local" | "apidev";

export type ResolvedBackend = {
  apiBaseUrl: string;
  authMode: AuthMode;
};

type Extra = {
  apiBaseUrl?: string;
};

const LOCAL_API_BASE_URL = "http://alanmac.christensen.org.nz:5266/";
const BACKEND_KEY = "nag.devOverride.backend";
// The implicit dev backend on a fresh install. Picking a different name
// from the dev menu writes BACKEND_KEY; clearing it falls back here.
const DEFAULT_DEV_BACKEND: BackendName = "local";

const logger = log("devOverrides");

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

const isBackendName = (s: unknown): s is BackendName =>
  s === "local" || s === "apidev";

/**
 * Resolve a named backend to its URL + auth mode. Throws if a required
 * env var is missing — callers must surface the error (dev menu shows
 * an alert; bootstrap logs and falls back to the default backend).
 */
export const resolveBackend = (name: BackendName): ResolvedBackend => {
  if (name === "local") {
    return { apiBaseUrl: LOCAL_API_BASE_URL, authMode: "dev-auth" };
  }
  // name === "apidev" — read the URL via Constants.expoConfig.extra so we
  // pick up whatever app.config.ts already forwarded from NAG_API_BASE_URL.
  // Direct process.env access only works for EXPO_PUBLIC_* in the bundled
  // app; everything else has to go through `extra`.
  const url = extra().apiBaseUrl;
  if (!url) {
    throw new Error(
      "NAG_API_BASE_URL is not set — add it to app/.env or app/.env.local",
    );
  }
  return { apiBaseUrl: url, authMode: "clerk" };
};

// Initial values used before `bootstrapDevOverrides` resolves. In dev,
// the default backend; in production, the EAS-injected URL + clerk.
const initialBackend = (): ResolvedBackend =>
  __DEV__
    ? resolveBackend(DEFAULT_DEV_BACKEND)
    : { apiBaseUrl: extra().apiBaseUrl ?? "", authMode: "clerk" };

let loaded = false;
let resolvedAuthMode: AuthMode = initialBackend().authMode;
let resolvedApiBaseUrl: string = initialBackend().apiBaseUrl;

/**
 * One-shot loader that reads the dev-menu backend selection out of
 * SecureStore and resolves the session's `authMode` + `apiBaseUrl`
 * constants. Must be awaited before the React tree mounts so api-client
 * construction (`getApiClient` in `apiClient.ts`) and
 * `<ClerkOrPassthrough>` see the final values. Runs once; subsequent
 * calls are no-ops.
 *
 * In production builds the overrides are ignored — `getAuthMode` and
 * `getApiBaseUrl` hard-return the env-derived initial values.
 * SecureStore reads are skipped entirely so a maliciously-planted entry
 * can't take effect on a release client.
 */
export const bootstrapDevOverrides = async (): Promise<void> => {
  if (loaded) return;
  if (!__DEV__) {
    loaded = true;
    return;
  }
  try {
    const stored = await SecureStore.getItemAsync(BACKEND_KEY);
    if (isBackendName(stored)) {
      try {
        const backend = resolveBackend(stored);
        resolvedApiBaseUrl = backend.apiBaseUrl;
        resolvedAuthMode = backend.authMode;
        logger.info(
          `override active backend=${stored} apiBaseUrl=${resolvedApiBaseUrl} authMode=${resolvedAuthMode}`,
        );
      } catch (error: unknown) {
        logger.warn(
          `stored backend=${stored} could not be resolved; falling back to default`,
          error,
        );
      }
    }
  } catch (error: unknown) {
    logger.warn("SecureStore read failed; falling back to default", error);
  }
  loaded = true;
};

/**
 * Resolved auth mode for this session. Read after `bootstrapDevOverrides`
 * resolves; before that, callers see the default backend's auth mode.
 */
export const getAuthMode = (): AuthMode => resolvedAuthMode;

/**
 * Resolved API base URL for this session. Read after
 * `bootstrapDevOverrides` resolves; before that, callers see the
 * default backend's URL.
 */
export const getApiBaseUrl = (): string => resolvedApiBaseUrl;

/**
 * Persists the selected backend name. Validates by resolving first —
 * throws on missing env so the dev menu can surface the error before
 * the user reloads. Caller is responsible for the follow-up DB /
 * secure-store wipe and `DevSettings.reload()`.
 */
export const setBackendOverride = async (name: BackendName): Promise<void> => {
  resolveBackend(name); // throws if env missing
  await SecureStore.setItemAsync(BACKEND_KEY, name);
  logger.info(`override set backend=${name}`);
};

/**
 * Removes any persisted override; the next `bootstrapDevOverrides` call
 * will resolve back to the default backend (`local`).
 */
export const clearBackendOverride = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(BACKEND_KEY);
  logger.info("override cleared — default backend will apply on next reload");
};
