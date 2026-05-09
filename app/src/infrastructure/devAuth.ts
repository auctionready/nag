import type { DevTokenResult, FetchDevTokenFn } from "@nag/core";
import { log } from "./log";
import { getApiBaseUrl } from "./devOverrides";

const logger = log("dev-auth");

const isUuidLike = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Hand-rolled fetch for `GET /dev/token` — the backend's DEBUG-only
 * endpoint that mints an HMAC device token for the SwaggerDevAuth
 * account/device pair. Hand-rolled because `/dev/token` is
 * `ExcludeFromDescription` server-side, so the OpenAPI spec the
 * `@nag/api-client` generator consumes does not include it.
 *
 * Never throws on network or HTTP errors — failures come back as a
 * tagged `DevTokenResult` for the caller to log + surface in the dev
 * menu. A 4xx (typically 404 against a non-DEBUG cloud backend) is
 * `non-retriable`; 5xx and network errors are `transient`.
 */
export const fetchDevToken: FetchDevTokenFn = async () => {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = `${base}/dev/token`;
  const start = Date.now();
  logger.debug(`GET ${url}`);
  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`network error ${message}`);
    return { ok: false, kind: "transient", message };
  }
  const elapsed = Date.now() - start;
  if (!response.ok) {
    const message = `${response.status} ${response.statusText}`;
    const kind: "transient" | "non-retriable" =
      response.status >= 500 ? "transient" : "non-retriable";
    logger.warn(`failed (${elapsed}ms) ${message}`);
    return kind === "transient"
      ? { ok: false, kind, message }
      : { ok: false, kind, status: response.status, message };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: "non-retriable", status: 200, message };
  }
  const b = body as Record<string, unknown> | null;
  // Endpoint serializes camelCased per ASP.NET Core defaults; tolerate
  // either casing in case the backend default ever flips back.
  const accountId = b?.accountId ?? b?.AccountId;
  const deviceId = b?.deviceId ?? b?.DeviceId;
  const token = b?.token ?? b?.Token;
  if (
    !isUuidLike(accountId) ||
    !isUuidLike(deviceId) ||
    typeof token !== "string" ||
    !token
  ) {
    logger.error(`malformed response`, body);
    return {
      ok: false,
      kind: "non-retriable",
      status: 200,
      message: "GET /dev/token returned an incomplete body",
    };
  }
  logger.info(`ok (${elapsed}ms) accountId=${accountId}`);
  return {
    ok: true,
    accountId,
    deviceId,
    deviceToken: token,
  } satisfies DevTokenResult;
};
