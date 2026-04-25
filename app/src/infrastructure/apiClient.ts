import Constants from "expo-constants";
import {
  createNagApiClient,
  postCommands as apiPostCommands,
  registerDevice as apiRegisterDevice,
  upgradeAccount as apiUpgradeAccount,
  getSync as apiGetSync,
  type NagApiClient,
  type UpgradeAccountResult,
  type GetSyncResult,
} from "@nag/api-client";
import {
  getDeviceToken,
  refreshDeviceToken,
  type CommandEnvelope,
  type GetSyncFn,
  type PostCommandsFn,
  type PostResult,
  type RegisterDeviceFn,
  type RegisterDeviceResult,
  type SyncResult,
} from "@nag/core";
import { db } from "../db";
import { log } from "./log";

type Extra = {
  apiBaseUrl?: string;
};

const logger = log("api");
const identityLogger = log("identity");

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

const maskToken = (token: string | null | undefined): string => {
  if (!token) return "<missing>";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
};

let singleton: NagApiClient | null = null;

/**
 * Lazily-built Zodios client (axios + zod request/response validation).
 *
 * Auth is per-request: `getToken` reads the persisted device token from
 * the SQLite `identity` row (populated by `ensureDeviceRegistered` on
 * first launch). `onUnauthorized` re-registers and updates the row when
 * the server rejects the current token, then the original request is
 * retried once. Bootstrap calls (`/devices/register` etc.) work without
 * a token because the request interceptor omits the header when
 * `getToken` returns `null`.
 *
 * `@nag/api-client` picks axios's default adapter — XHR on RN — which
 * is stable against HTTP+localhost; an earlier `adapter: "fetch"`
 * override hung on chunked responses in the iOS simulator.
 */
export const getApiClient = (): NagApiClient => {
  if (singleton) return singleton;
  const { apiBaseUrl } = extra();
  if (!apiBaseUrl) {
    throw new Error(
      "API client not configured: set NAG_API_BASE_URL " +
        "(see app.config.ts → extra).",
    );
  }
  logger.debug(`creating client baseUrl=${apiBaseUrl}`);
  singleton = createNagApiClient({
    baseUrl: apiBaseUrl,
    getToken: () => getDeviceToken(db),
    onUnauthorized: async () => {
      identityLogger.warn(
        "received 401 on protected request — refreshing device token",
      );
      const newToken = await refreshDeviceToken({
        db,
        register: registerDeviceRaw,
        log: identityLogger,
      });
      if (newToken) {
        identityLogger.info(
          `device token refreshed (token=${maskToken(newToken)})`,
        );
        return true;
      }
      identityLogger.error("device token refresh failed — giving up");
      return false;
    },
  });
  return singleton;
};

export const isApiConfigured = (): boolean => {
  const { apiBaseUrl } = extra();
  return Boolean(apiBaseUrl);
};

/** One-time startup announcement of the API configuration state. */
export const logApiConfig = (): void => {
  const { apiBaseUrl } = extra();
  logger.info(
    `config apiBaseUrl=${apiBaseUrl || "<missing>"} configured=${isApiConfigured()}`,
  );
};

/**
 * Direct register-device wrapper used both by the boot-time
 * `ensureDeviceRegistered` call and by the 401-refresh flow inside
 * `onUnauthorized`. Goes through the same singleton client — the
 * `/devices/register` endpoint is anonymous and `[NotTenanted]`, so it
 * accepts the request whether or not the current token is still valid.
 */
const registerDeviceRaw: RegisterDeviceFn = (
  request,
): Promise<RegisterDeviceResult> =>
  apiRegisterDevice(getApiClient(), request, logger);

export const postCommands: PostCommandsFn = (
  envelope: CommandEnvelope,
): Promise<PostResult> => apiPostCommands(getApiClient(), envelope, logger);

export const registerDevice: RegisterDeviceFn = registerDeviceRaw;

export const upgradeAccount = (request: {
  deviceId: string;
  idpToken: string;
}): Promise<UpgradeAccountResult> =>
  apiUpgradeAccount(getApiClient(), request, logger);

/**
 * Adapter from `@nag/api-client.getSync` (returns a Zodios-typed body)
 * to `@nag/core.GetSyncFn` (the loose `SyncResult` shape the pull-sync
 * orchestrator works with). The cast is safe because the Zodios schema
 * mirrors `SyncResult` field-for-field.
 */
export const getSync: GetSyncFn = async (since) => {
  const result: GetSyncResult = await apiGetSync(getApiClient(), since, logger);
  if (result.ok) {
    return { ok: true, response: result.response as SyncResult };
  }
  return result;
};
