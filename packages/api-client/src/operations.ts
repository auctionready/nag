import { isAxiosError } from "axios";
import type { ZodiosBodyByAlias, ZodiosResponseByAlias } from "@zodios/core";
import type { NagApiClient } from "./client";
import type { endpoints } from "./endpoint-definition";

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
  | { ok: true; accountId: string; registeredAt: Date }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/** HTTP status codes that indicate a transient failure callers should retry. */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

type Failure =
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

const classifyError = (
  error: unknown,
  label: string,
  log: WrapperLog | undefined,
  elapsedMs: number,
): Failure => {
  if (isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message =
        (data as { message?: string } | undefined)?.message ??
        (typeof data === "string" ? data : "") ??
        error.message;
      if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
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
    return classifyError(error, "POST /commands", log, Date.now() - start);
  }
};

type RegisterDeviceBody = ZodiosBodyByAlias<Endpoints, "postDevicesregister">;
type RegisterDeviceResponse = ZodiosResponseByAlias<
  Endpoints,
  "postDevicesregister"
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
    const response: RegisterDeviceResponse = await client.postDevicesregister(
      request as RegisterDeviceBody,
    );
    const elapsed = Date.now() - start;
    if (!response.accountId || !response.registeredAt) {
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
    };
  } catch (error: unknown) {
    return classifyError(
      error,
      "POST /devices/register",
      log,
      Date.now() - start,
    );
  }
};
