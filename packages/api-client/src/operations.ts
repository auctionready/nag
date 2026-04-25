import { isAxiosError } from "axios";
import {
  isErrorFromAlias,
  type ZodiosBodyByAlias,
  type ZodiosErrorByAlias,
  type ZodiosResponseByAlias,
} from "@zodios/core";
import type { NagApiClient } from "./client";
import { endpoints } from "./endpoint-definition";

export type Endpoints = typeof endpoints;

/**
 * Optional structured log sink. Each method takes the same shape as the
 * app's `log()` factory: `(...args: unknown[]) => void`. All methods are
 * optional — pass an empty object (or omit) to silence.
 */
export type WrapperLog = {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

/**
 * Wire shape of an outbound command envelope. Wider than the generated
 * Zodios `postCommands_Body` discriminated union so the outbox dispatcher
 * can ship whatever the audit log captured — the server re-validates
 * against the same Zod schema and rejects anything malformed with a 400.
 */
export type CommandEnvelope = {
  id: string;
  timestamp: string;
  type: string;
  payload: unknown;
};

export type PostResult =
  | { ok: true; sequence: number }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

export type RegisterDeviceResult =
  | {
      ok: true;
      accountId: string;
      registeredAt: Date;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/** HTTP status codes outside 5xx that still indicate a transient failure. */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

const isTransientStatus = (status: number): boolean =>
  status >= 500 || TRANSIENT_STATUSES.has(status);

type Failure =
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * Builds the appropriate `Failure` shape for an axios response error or a
 * raw network/unexpected error. The caller supplies an alias-narrowed
 * extractor so that documented error bodies (e.g. `ErrorResponse` for 400s)
 * are typed when reading `errors[0]`.
 */
const failureFromError = (
  label: string,
  log: WrapperLog | undefined,
  elapsedMs: number,
  error: unknown,
  extractDocumentedMessage: () => string | undefined,
): Failure => {
  if (isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message =
        extractDocumentedMessage() ??
        (data as { message?: string } | undefined)?.message ??
        (typeof data === "string" ? data : "") ??
        error.message;
      if (isTransientStatus(status)) {
        log?.warn?.(
          `${label} transient (${elapsedMs}ms) status=${status}`,
          data,
        );
        return {
          ok: false,
          kind: "transient",
          message: `${status}: ${message}`,
        };
      }
      log?.error?.(
        `${label} non-retriable (${elapsedMs}ms) status=${status}`,
        data,
      );
      return { ok: false, kind: "non-retriable", status, message };
    }
    log?.warn?.(
      `${label} network error (${elapsedMs}ms) code=${error.code} message=${error.message}`,
    );
    return {
      ok: false,
      kind: "transient",
      message: error.message || "network error",
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  log?.error?.(`${label} unexpected error (${elapsedMs}ms)`, error);
  return { ok: false, kind: "transient", message };
};

type PostCommandsBody = ZodiosBodyByAlias<Endpoints, "postCommands">;
type PostCommandsResponse = ZodiosResponseByAlias<Endpoints, "postCommands">;
type PostCommandsError400 = ZodiosErrorByAlias<Endpoints, "postCommands", 400>;

// Re-export the mapped type for downstream callers that want to peek at the
// documented 400 body shape without re-deriving it.
export type { ZodiosErrorByAlias };

/**
 * POSTs a command envelope and translates the Zodios/axios response into
 * a `PostResult`. Never throws on HTTP or network errors — the caller
 * (dispatcher) reads `result.ok` and decides what to do.
 */
export const postCommands = async (
  client: NagApiClient,
  envelope: CommandEnvelope,
  log?: WrapperLog,
): Promise<PostResult> => {
  log?.debug?.(
    `POST /commands id=${envelope.id} type=${envelope.type} timestamp=${envelope.timestamp}`,
  );
  const start = Date.now();
  try {
    const response: PostCommandsResponse = await client.postCommands(
      envelope as PostCommandsBody,
    );
    const elapsed = Date.now() - start;
    log?.debug?.(
      `POST /commands ok (${elapsed}ms) sequence=${response.sequence} accepted=${(response as { accepted?: boolean }).accepted}`,
    );
    return { ok: true, sequence: response.sequence ?? 0 };
  } catch (error: unknown) {
    return failureFromError(
      "POST /commands",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postCommands", error)) {
          // The endpoint documents both a 400 (ErrorResponse) and a 404
          // (void; the latter comes from Wolverine HTTP's tenant-not-found
          // path). Narrow to the ErrorResponse-shaped variant for the
          // documented-message extraction.
          const data = error.response.data as PostCommandsError400 | void;
          return data && typeof data === "object" && "errors" in data
            ? (data as { errors?: string[] }).errors?.[0]
            : undefined;
        }
        return undefined;
      },
    );
  }
};

type RegisterDeviceBody = ZodiosBodyByAlias<Endpoints, "postDevicesRegister">;
type RegisterDeviceResponse = ZodiosResponseByAlias<
  Endpoints,
  "postDevicesRegister"
>;
type RegisterDeviceError400 = ZodiosErrorByAlias<
  Endpoints,
  "postDevicesRegister",
  400
>;

/**
 * POSTs a device-registration request and translates the Zodios/axios
 * response into a `RegisterDeviceResult`. Idempotent server-side on
 * `deviceId`. Never throws on HTTP or network errors.
 */
export const registerDevice = async (
  client: NagApiClient,
  request: { deviceId: string },
  log?: WrapperLog,
): Promise<RegisterDeviceResult> => {
  log?.debug?.(`POST /devices/register deviceId=${request.deviceId}`);
  const start = Date.now();
  try {
    const response: RegisterDeviceResponse = await client.postDevicesRegister(
      request as RegisterDeviceBody,
    );
    const elapsed = Date.now() - start;
    if (
      !response.accountId ||
      !response.registeredAt ||
      !response.deviceToken
    ) {
      log?.error?.(
        `POST /devices/register ok (${elapsed}ms) but response missing fields`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete RegisterDeviceResponse",
      };
    }
    log?.info?.(
      `POST /devices/register ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return {
      ok: true,
      accountId: response.accountId,
      registeredAt: response.registeredAt,
      deviceToken: response.deviceToken,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /devices/register",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postDevicesRegister", error)) {
          const data = error.response.data as RegisterDeviceError400 | void;
          return data && typeof data === "object" && "errors" in data
            ? (data as { errors?: string[] }).errors?.[0]
            : undefined;
        }
        return undefined;
      },
    );
  }
};

export type UpgradeAccountResult =
  | {
      ok: true;
      accountId: string;
      idpSubject: string;
      upgradedAt: Date;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type UpgradeAccountBody = ZodiosBodyByAlias<Endpoints, "postAccountsUpgrade">;
type UpgradeAccountResponse = ZodiosResponseByAlias<
  Endpoints,
  "postAccountsUpgrade"
>;
type UpgradeAccountError400 = ZodiosErrorByAlias<
  Endpoints,
  "postAccountsUpgrade",
  400
>;

const upgradeAccountOnce = async (
  client: NagApiClient,
  request: { deviceId: string; idpToken: string },
  log: WrapperLog | undefined,
): Promise<UpgradeAccountResult> => {
  const start = Date.now();
  try {
    const response: UpgradeAccountResponse = await client.postAccountsUpgrade(
      request as UpgradeAccountBody,
    );
    const elapsed = Date.now() - start;
    if (
      !response.accountId ||
      !response.idpSubject ||
      !response.upgradedAt ||
      !response.deviceToken
    ) {
      log?.error?.(
        `POST /accounts/upgrade ok (${elapsed}ms) but response missing fields`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete UpgradeAccountResponse",
      };
    }
    log?.info?.(
      `POST /accounts/upgrade ok (${elapsed}ms) accountId=${response.accountId} sub=${response.idpSubject}`,
    );
    return {
      ok: true,
      accountId: response.accountId,
      idpSubject: response.idpSubject,
      upgradedAt: response.upgradedAt,
      deviceToken: response.deviceToken,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /accounts/upgrade",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postAccountsUpgrade", error)) {
          const data: UpgradeAccountError400 = error.response.data;
          return data.errors?.[0];
        }
        return undefined;
      },
    );
  }
};

type GetSyncResponse = ZodiosResponseByAlias<Endpoints, "getSync">;

export type GetSyncResult =
  | { ok: true; response: GetSyncResponse }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * GETs `/sync?since=<n>` and returns either a replay batch or a snapshot.
 * Never throws on HTTP/network errors — caller (pull-sync orchestrator)
 * decides what to do based on `result.ok`. Replay/snapshot dispatch is
 * the caller's responsibility.
 */
export const getSync = async (
  client: NagApiClient,
  since: number,
  log?: WrapperLog,
): Promise<GetSyncResult> => {
  log?.debug?.(`GET /sync since=${since}`);
  const start = Date.now();
  try {
    const response: GetSyncResponse = await client.getSync({
      queries: { since },
    });
    const elapsed = Date.now() - start;
    log?.debug?.(`GET /sync ok (${elapsed}ms) mode=${response.mode}`);
    return { ok: true, response };
  } catch (error: unknown) {
    return failureFromError(
      "GET /sync",
      log,
      Date.now() - start,
      error,
      () => undefined,
    );
  }
};

/**
 * POSTs an account-upgrade request — binds the calling device's anonymous
 * account to a Clerk-issued identity. Idempotent server-side on
 * `(account, sub)`, so re-attempting after a transient failure is safe;
 * the server returns 200 with the existing `UpgradedAt` if the
 * `(deviceId, sub)` pair already matches.
 *
 * Auto-retries up to 2 extra times on transient failures (5xx, 408/425/429,
 * network/timeout). The Lambda's first cold call can run ~19s while it
 * fetches Clerk's JWKS, validates the JWT, and warms Marten — well within
 * the 30s axios timeout but occasionally clipping it. Subsequent attempts
 * hit a warm container and complete in <1s.
 */
export const upgradeAccount = async (
  client: NagApiClient,
  request: { deviceId: string; idpToken: string },
  log?: WrapperLog,
): Promise<UpgradeAccountResult> => {
  log?.debug?.(`POST /accounts/upgrade deviceId=${request.deviceId}`);

  const maxAttempts = 3;
  let last: UpgradeAccountResult = {
    ok: false,
    kind: "transient",
    message: "no attempts ran",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await upgradeAccountOnce(client, request, log);
    if (last.ok) return last;
    if (last.kind === "non-retriable") return last;
    if (attempt < maxAttempts) {
      const delayMs = 1000 * attempt;
      log?.warn?.(
        `POST /accounts/upgrade transient attempt ${attempt}/${maxAttempts} (${last.message}) — retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return last;
};
