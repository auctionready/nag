import Constants from "expo-constants";
import { isAxiosError } from "axios";
import { createNagApiClient, type NagApiClient } from "@nag/api-client";
import type { CommandEnvelope, PostCommandsFn, PostResult } from "@nag/core";

type Extra = {
  apiBaseUrl?: string;
  apiKey?: string;
};

let singleton: NagApiClient | null = null;

const extra = (): Extra => (Constants.expoConfig?.extra as Extra) ?? {};

export const getApiClient = (): NagApiClient => {
  if (singleton) return singleton;
  const { apiBaseUrl, apiKey } = extra();
  if (!apiBaseUrl || !apiKey) {
    throw new Error(
      "API client not configured: set NAG_API_BASE_URL and NAG_API_KEY " +
        "(see app.config.ts → extra).",
    );
  }
  singleton = createNagApiClient({ baseUrl: apiBaseUrl, apiKey });
  return singleton;
};

export const isApiConfigured = (): boolean => {
  const { apiBaseUrl, apiKey } = extra();
  return Boolean(apiBaseUrl) && Boolean(apiKey);
};

/** HTTP status codes that indicate a transient failure we should retry. */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

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
  try {
    const response = await client.postCommands(
      envelope as Parameters<typeof client.postCommands>[0],
    );
    return { ok: true, sequence: response.sequence ?? 0 };
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string } | undefined;
      const message = data?.message ?? error.message;
      if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
        return {
          ok: false,
          kind: "transient",
          message: `${status}: ${message}`,
        };
      }
      return { ok: false, kind: "non-retriable", status, message };
    }
    // Network error, timeout, or thrown before a response — let the
    // dispatcher treat it as transient.
    throw error;
  }
};
