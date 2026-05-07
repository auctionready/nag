import { isAxiosError } from "axios";
import { endpoints } from "../endpoint-definition";

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

export type Failure =
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/** HTTP status codes outside 5xx that still indicate a transient failure. */
const TRANSIENT_STATUSES = new Set([408, 425, 429]);

const isTransientStatus = (status: number): boolean =>
  status >= 500 || TRANSIENT_STATUSES.has(status);

/**
 * Builds the appropriate `Failure` shape for an axios response error or a
 * raw network/unexpected error. The caller supplies an alias-narrowed
 * extractor so that documented error bodies (e.g. `ErrorResponse` for 400s)
 * are typed when reading `errors[0]`.
 */
export const failureFromError = (
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
