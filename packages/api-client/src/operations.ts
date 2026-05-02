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
 * Wire shape of an outbound write envelope. Wider than the generated
 * Zodios `postEvents_Body` (whose `events` array is a discriminated union)
 * so the outbox dispatcher can ship whatever the auditor captured — the
 * server re-validates each event entry and rejects anything malformed
 * with a 400.
 */
export type EventEntry = {
  type: string;
  payload: unknown;
};

export type WriteEventEnvelope = {
  id: string;
  timestamp: string;
  events: EventEntry[];
};

/**
 * One event the server appended for an envelope, mirrored back on the
 * `POST /events` response (or fetched from
 * `GET /events/by-envelope/{id}`). Aliased to the generated Zodios
 * discriminated-union type — sequence + timestamp are server-assigned
 * and Zodios coerces `timestamp` to `Date` per the schema.
 */
export type AppendedEvent = NonNullable<
  ZodiosResponseByAlias<Endpoints, "postEvents">["events"]
>[number];

export type PostResult =
  | { ok: true; sequence: number; events: AppendedEvent[] }
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
  /**
   * HTTP statuses the caller knows about and intends to handle (e.g. 409
   * from /accounts/upgrade, which the conflict-resolution flow expects).
   * Logged at INFO instead of ERROR so the dev console doesn't surface a
   * scary "ERROR" line for a documented control-flow response.
   */
  expectedStatuses: readonly number[] = [],
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
      if (expectedStatuses.includes(status)) {
        log?.info?.(
          `${label} expected non-retriable (${elapsedMs}ms) status=${status}`,
          data,
        );
      } else {
        log?.error?.(
          `${label} non-retriable (${elapsedMs}ms) status=${status}`,
          data,
        );
      }
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

// Re-export the mapped type for downstream callers that want to peek at the
// documented 400 body shape without re-deriving it.
export type { ZodiosErrorByAlias };

type PostEventsBody = ZodiosBodyByAlias<Endpoints, "postEvents">;
type PostEventsResponse = ZodiosResponseByAlias<Endpoints, "postEvents">;
type PostEventsError400 = ZodiosErrorByAlias<Endpoints, "postEvents", 400>;

/**
 * POSTs a write-event envelope and translates the response into a
 * `PostResult`. The server returns 201 (first time) or 200 (duplicate
 * replay) with an `EventsByEnvelope` body — the events the server
 * actually appended, with sequence + timestamp + payload. The wrapper
 * surfaces those events so the dispatcher can reconcile against its
 * optimistic local state without a follow-up GET.
 *
 * Never throws on HTTP or network errors — the caller (dispatcher)
 * reads `result.ok` and decides what to do.
 */
export const postEvents = async (
  client: NagApiClient,
  envelope: WriteEventEnvelope,
  log?: WrapperLog,
): Promise<PostResult> => {
  const types = envelope.events.map((e) => e.type).join(",");
  log?.debug?.(
    `POST /events id=${envelope.id} types=[${types}] timestamp=${envelope.timestamp}`,
  );
  const start = Date.now();
  try {
    const response: PostEventsResponse = await client.postEvents(
      envelope as PostEventsBody,
    );
    const elapsed = Date.now() - start;
    const events = response.events ?? [];
    const sequence = events.length > 0 ? events[events.length - 1].sequence : 0;
    log?.debug?.(
      `POST /events ok (${elapsed}ms) sequence=${sequence} events=${events.length}`,
    );
    return { ok: true, sequence, events };
  } catch (error: unknown) {
    return failureFromError(
      "POST /events",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postEvents", error)) {
          const data = error.response.data as PostEventsError400 | void;
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
  request: { deviceId: string; idpToken: string; force?: boolean },
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
      // 409 is the documented "identity already bound to a different
      // account" / "account already bound to a different identity"
      // response; the conflict-resolution flow in account.tsx handles it.
      [409],
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
  request: { deviceId: string; idpToken: string; force?: boolean },
  log?: WrapperLog,
): Promise<UpgradeAccountResult> => {
  log?.debug?.(
    `POST /accounts/upgrade deviceId=${request.deviceId}${request.force ? " force=true" : ""}`,
  );

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

export type PairDeviceResult =
  | {
      ok: true;
      accountId: string;
      deviceId: string;
      registeredAt: Date;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type PairDeviceBody = ZodiosBodyByAlias<Endpoints, "postDevicesPair">;
type PairDeviceResponse = ZodiosResponseByAlias<Endpoints, "postDevicesPair">;
type PairDeviceError400 = ZodiosErrorByAlias<Endpoints, "postDevicesPair", 400>;

/**
 * POSTs a device-pair request — attaches the calling device to an account
 * already bound to the verified Clerk identity. Used as the second-device
 * fallback when `/accounts/upgrade` returns 409 ("identity already bound to
 * a different account"): the app calls this to re-parent the device's
 * anonymous registration onto the existing account, then wipes local data
 * and pulls a fresh snapshot. Idempotent server-side on
 * `(deviceId, account)`, so retrying after a transient failure is safe.
 *
 * Never throws on HTTP/network errors — caller reads `result.ok`.
 */
export const pairDevice = async (
  client: NagApiClient,
  request: { deviceId: string; idpToken: string; label?: string | null },
  log?: WrapperLog,
): Promise<PairDeviceResult> => {
  log?.debug?.(`POST /devices/pair deviceId=${request.deviceId}`);
  const start = Date.now();
  try {
    const response: PairDeviceResponse = await client.postDevicesPair(
      request as PairDeviceBody,
    );
    const elapsed = Date.now() - start;
    if (
      !response.accountId ||
      !response.deviceId ||
      !response.registeredAt ||
      !response.deviceToken
    ) {
      log?.error?.(
        `POST /devices/pair ok (${elapsed}ms) but response missing fields`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete PairDeviceResponse",
      };
    }
    log?.info?.(
      `POST /devices/pair ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return {
      ok: true,
      accountId: response.accountId,
      deviceId: response.deviceId,
      registeredAt: response.registeredAt,
      deviceToken: response.deviceToken,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /devices/pair",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postDevicesPair", error)) {
          const data = error.response.data as PairDeviceError400 | void;
          return data && typeof data === "object" && "errors" in data
            ? (data as { errors?: string[] }).errors?.[0]
            : undefined;
        }
        return undefined;
      },
    );
  }
};

export type UnbindAccountResult =
  | { ok: true; accountId: string }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type UnbindAccountResponse = ZodiosResponseByAlias<
  Endpoints,
  "postAccountsUnbind"
>;
type UnbindAccountError401 = ZodiosErrorByAlias<
  Endpoints,
  "postAccountsUnbind",
  401
>;

/**
 * POSTs an account-unbind request — clears the bound Clerk identity
 * (`IdpSubject` / `UpgradedAt`) on the calling device's account so the
 * next sign-in can rebind it to a different identity. Habit data is
 * untouched. Server-side idempotent: re-running on an already-anonymous
 * account is a 200 no-op, so retrying after a transient failure is safe.
 *
 * Edge case to flag to the caller: any *second* device that hasn't
 * paired yet will see `/devices/pair` return 404 ("no account found for
 * this identity") until any device re-runs `/accounts/upgrade`.
 * Already-paired devices are unaffected — they hold their own HMAC
 * device token, which doesn't depend on `IdpSubject`.
 */
export const unbindAccount = async (
  client: NagApiClient,
  log?: WrapperLog,
): Promise<UnbindAccountResult> => {
  log?.debug?.("POST /accounts/unbind");
  const start = Date.now();
  try {
    const response: UnbindAccountResponse =
      await client.postAccountsUnbind(undefined);
    const elapsed = Date.now() - start;
    if (!response.accountId) {
      log?.error?.(
        `POST /accounts/unbind ok (${elapsed}ms) but response missing accountId`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete UnbindAccountResponse",
      };
    }
    log?.info?.(
      `POST /accounts/unbind ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return { ok: true, accountId: response.accountId };
  } catch (error: unknown) {
    return failureFromError(
      "POST /accounts/unbind",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postAccountsUnbind", error)) {
          const data = error.response.data as UnbindAccountError401;
          return data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
