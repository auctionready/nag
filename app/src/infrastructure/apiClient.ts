import Constants from "expo-constants";
import { isAxiosError } from "axios";
import { createNagApiClient, type NagApiClient } from "@nag/api-client";
import type { CommandEnvelope, PostCommandsFn, PostResult } from "@nag/core";
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

/** HTTP status codes that indicate a transient failure we should retry. */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

/**
 * Translates a Zodios/axios result into the dispatcher's `PostResult`
 * shape. Network failures / timeouts are re-thrown so the dispatcher's
 * catch branch handles them as transient (offline).
 *
 * The envelope is cast at the boundary because Zodios's generated body
 * type is a closed discriminated union; the dispatcher ships whatever
 * the audit log captured, which the server re-validates against the
 * same schema.
 */
export const postCommands: PostCommandsFn = async (
  envelope: CommandEnvelope,
): Promise<PostResult> => {
  const client = getApiClient();
  logger.debug(
    `POST /commands id=${envelope.id} type=${envelope.type} timestamp=${envelope.timestamp}`,
  );
  logger.debug(`POST /commands body=${JSON.stringify(envelope)}`);
  const start = Date.now();
  try {
    const response = await client.postCommands(
      envelope as Parameters<typeof client.postCommands>[0],
    );
    const elapsed = Date.now() - start;
    logger.debug(
      `POST /commands ok (${elapsed}ms) sequence=${response.sequence} accepted=${(response as { accepted?: boolean }).accepted}`,
    );
    return { ok: true, sequence: response.sequence ?? 0 };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    if (isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const message =
          (data as { message?: string } | undefined)?.message ??
          (typeof data === "string" ? data : "") ??
          error.message;
        if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
          logger.warn(
            `POST /commands transient (${elapsed}ms) status=${status}`,
            data,
          );
          return {
            ok: false,
            kind: "transient",
            message: `${status}: ${message}`,
          };
        }
        logger.error(
          `POST /commands non-retriable (${elapsed}ms) status=${status}`,
          data,
        );
        return { ok: false, kind: "non-retriable", status, message };
      }
      // Timeout or network-level failure (no response received).
      logger.warn(
        `POST /commands network error (${elapsed}ms) code=${error.code} message=${error.message}`,
      );
      throw error;
    }
    logger.error(`POST /commands unexpected error (${elapsed}ms)`, error);
    throw error;
  }
};
