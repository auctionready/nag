import Constants from "expo-constants";
import { isAxiosError } from "axios";
import { createNagApiClient, type NagApiClient } from "@nag/api-client";
import type { CommandEnvelope, PostCommandsFn, PostResult } from "@nag/core";
import { log } from "./log";

type Extra = {
  apiBaseUrl?: string;
  apiKey?: string;
};

let singleton: NagApiClient | null = null;
const logger = log("api");

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

const maskKey = (key: string | undefined): string => {
  if (!key) return "<missing>";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
};

export const getApiClient = (): NagApiClient => {
  if (singleton) return singleton;
  const { apiBaseUrl, apiKey } = extra();
  if (!apiBaseUrl || !apiKey) {
    throw new Error(
      "API client not configured: set NAG_API_BASE_URL and NAG_API_KEY " +
        "(see app.config.ts → extra).",
    );
  }
  logger.info(
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
 * Wall-clock budget per POST /commands request. Without this the Zodios/
 * axios client (which has no default timeout) hangs indefinitely against
 * an unreachable backend, which leaves the sync provider stuck in
 * `"syncing"` state forever. Timeouts surface as transient errors → the
 * row stays pending and retries on the next trigger.
 */
const POST_TIMEOUT_MS = 20_000;

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
  }) as Promise<T>;
};

/**
 * Translates a Zodios/axios result into the dispatcher's `PostResult`
 * shape. Network failures are re-thrown so the dispatcher's catch branch
 * handles them as transient (offline).
 *
 * The envelope is cast at the boundary because Zodios's generated body type
 * is a closed discriminated union; the dispatcher ships whatever the audit
 * log captured, which is already validated server-side by the same schema.
 */
export const postCommands: PostCommandsFn = async (
  envelope: CommandEnvelope,
): Promise<PostResult> => {
  const client = getApiClient();
  logger.debug(
    `POST /commands id=${envelope.id} type=${envelope.type} timestamp=${envelope.timestamp}`,
  );
  const start = Date.now();
  try {
    const response = await withTimeout(
      client.postCommands(
        envelope as Parameters<typeof client.postCommands>[0],
      ),
      POST_TIMEOUT_MS,
      "POST /commands",
    );
    logger.debug(
      `POST /commands ok (${Date.now() - start}ms) sequence=${response.sequence} accepted=${(response as { accepted?: boolean }).accepted}`,
    );
    return { ok: true, sequence: response.sequence ?? 0 };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    if (isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string } | undefined;
      const message = data?.message ?? error.message;
      if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
        logger.warn(
          `POST /commands transient (${elapsed}ms) status=${status}`,
          message,
        );
        return {
          ok: false,
          kind: "transient",
          message: `${status}: ${message}`,
        };
      }
      logger.error(
        `POST /commands non-retriable (${elapsed}ms) status=${status}`,
        message,
      );
      return { ok: false, kind: "non-retriable", status, message };
    }
    // Network error, timeout, or thrown before a response — let the
    // dispatcher treat it as transient.
    logger.warn(
      `POST /commands network/timeout error (${elapsed}ms, rethrowing)`,
      error,
    );
    throw error;
  }
};
