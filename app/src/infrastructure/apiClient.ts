import Constants from "expo-constants";
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
 * Wall-clock budget per POST /commands request. An AbortController fires
 * at expiry so the underlying fetch is torn down (not just abandoned) —
 * fixes the zombie-promise-across-Metro-reload issue we saw with the
 * axios/fetch adapter combo.
 */
const POST_TIMEOUT_MS = 20_000;

const joinUrl = (base: string, path: string): string => {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
};

/**
 * POSTs a CommandEnvelope to `/commands` using raw `fetch`, bypassing
 * axios + zodios entirely.
 *
 * Why raw fetch: the previous implementation went through
 * `@zodios/core` on top of axios-with-fetch-adapter. Under React
 * Native + Hermes we observed the POST promise neither resolving nor
 * rejecting even when the server returned 200 — classic "response
 * coalescing / adapter bug" signature. Raw fetch keeps the transport
 * deterministic and easy to instrument; zodios is still available for
 * other endpoints via `@nag/api-client`, we just don't route commands
 * through it.
 */
export const postCommands: PostCommandsFn = async (
  envelope: CommandEnvelope,
): Promise<PostResult> => {
  const { apiBaseUrl, apiKey } = extra();
  if (!apiBaseUrl || !apiKey) {
    throw new Error(
      "API client not configured: set NAG_API_BASE_URL and NAG_API_KEY " +
        "(see app.config.ts → extra).",
    );
  }
  const url = joinUrl(apiBaseUrl, "/commands");
  const body = JSON.stringify(envelope);

  logger.debug(
    `POST ${url} id=${envelope.id} type=${envelope.type} timestamp=${envelope.timestamp}`,
  );
  logger.debug(`POST ${url} body=${body}`);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  const start = Date.now();

  try {
    logger.debug(`POST ${url} fetch() …`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        // Force the server to close the connection after responding so
        // we don't block on chunked-transfer tail handling. RN's fetch
        // on iOS simulator against HTTP+localhost has been observed
        // to hang waiting for the 0-length terminator otherwise.
        Connection: "close",
      },
      body,
      signal: controller.signal,
    });
    const fetchElapsed = Date.now() - start;
    const status = response.status;
    const contentLength = response.headers.get("content-length");
    logger.debug(
      `POST ${url} fetch() resolved status=${status} content-length=${contentLength ?? "<null/chunked>"} (${fetchElapsed}ms)`,
    );

    logger.debug(`POST ${url} reading body …`);
    const text = await response.text();
    const totalElapsed = Date.now() - start;
    logger.debug(
      `POST ${url} body read length=${text.length} total=${totalElapsed}ms`,
    );

    if (status >= 200 && status < 300) {
      let parsed: { sequence?: number; accepted?: boolean } = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch (e) {
        logger.warn(`POST ${url} response JSON parse failed`, e, text);
      }
      logger.debug(
        `POST ${url} ok sequence=${parsed.sequence} accepted=${parsed.accepted}`,
      );
      return { ok: true, sequence: parsed.sequence ?? 0 };
    }

    if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
      logger.warn(
        `POST ${url} transient (${totalElapsed}ms) status=${status}`,
        text,
      );
      return {
        ok: false,
        kind: "transient",
        message: `${status}: ${text.slice(0, 500)}`,
      };
    }

    logger.error(
      `POST ${url} non-retriable (${totalElapsed}ms) status=${status}`,
      text,
    );
    return {
      ok: false,
      kind: "non-retriable",
      status,
      message: text.slice(0, 500) || response.statusText,
    };
  } catch (error: unknown) {
    const elapsed = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`POST ${url} aborted after timeout (${elapsed}ms)`);
      throw new Error(`POST ${url} timed out after ${POST_TIMEOUT_MS}ms`);
    }
    logger.warn(
      `POST ${url} network error (${elapsed}ms, rethrowing): ${message}`,
    );
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};
