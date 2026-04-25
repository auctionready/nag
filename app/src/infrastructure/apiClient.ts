import Constants from "expo-constants";
import {
  createNagApiClient,
  postCommands as apiPostCommands,
  registerDevice as apiRegisterDevice,
  upgradeAccount as apiUpgradeAccount,
  type NagApiClient,
  type UpgradeAccountResult,
} from "@nag/api-client";
import type {
  CommandEnvelope,
  PostCommandsFn,
  PostResult,
  RegisterDeviceFn,
  RegisterDeviceResult,
} from "@nag/core";
import { log } from "./log";

type Extra = {
  apiBaseUrl?: string;
  apiKey?: string;
};

const logger = log("api");

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

const maskKey = (key: string | undefined): string => {
  if (!key) return "<missing>";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
};

let singleton: NagApiClient | null = null;

/**
 * Lazily-built Zodios client (axios + zod request/response validation).
 * `@nag/api-client` picks axios's default adapter — XHR on RN — which
 * is stable against HTTP+localhost; an earlier `adapter: "fetch"`
 * override hung on chunked responses in the iOS simulator.
 */
export const getApiClient = (): NagApiClient => {
  if (singleton) return singleton;
  const { apiBaseUrl, apiKey } = extra();
  if (!apiBaseUrl || !apiKey) {
    throw new Error(
      "API client not configured: set NAG_API_BASE_URL and NAG_API_KEY " +
        "(see app.config.ts → extra).",
    );
  }
  logger.debug(
    `creating client baseUrl=${apiBaseUrl} apiKey=${maskKey(apiKey)}`,
  );
  singleton = createNagApiClient({ baseUrl: apiBaseUrl, apiKey });
  return singleton;
};

export const isApiConfigured = (): boolean => {
  const { apiBaseUrl, apiKey } = extra();
  return Boolean(apiBaseUrl) && Boolean(apiKey);
};

/** One-time startup announcement of the API configuration state. */
export const logApiConfig = (): void => {
  const { apiBaseUrl, apiKey } = extra();
  logger.info(
    `config apiBaseUrl=${apiBaseUrl || "<missing>"} apiKey=${maskKey(apiKey)} configured=${isApiConfigured()}`,
  );
};

export const postCommands: PostCommandsFn = (
  envelope: CommandEnvelope,
): Promise<PostResult> => apiPostCommands(getApiClient(), envelope, logger);

export const registerDevice: RegisterDeviceFn = (
  request,
): Promise<RegisterDeviceResult> =>
  apiRegisterDevice(getApiClient(), request, logger);

export const upgradeAccount = (request: {
  deviceId: string;
  idpToken: string;
}): Promise<UpgradeAccountResult> =>
  apiUpgradeAccount(getApiClient(), request, logger);
