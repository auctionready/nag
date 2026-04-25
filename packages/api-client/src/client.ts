import axios, {
  isAxiosError,
  type InternalAxiosRequestConfig,
  AxiosHeaders,
} from "axios";
import { Zodios } from "@zodios/core";
import { endpoints } from "./endpoint-definition";

/**
 * Controls zodios's runtime schema validation.
 *
 *   - `true` / `"all"` — validate both request bodies and responses
 *     against the generated zod schemas (default).
 *   - `"request"` — only request bodies.
 *   - `"response"` — only responses.
 *   - `"none"` / `false` — skip all validation.
 *
 * Mirrors `@zodios/core`'s own `validate` option; see zodios docs.
 */
export type NagApiValidate = boolean | "request" | "response" | "all" | "none";

export type GetToken = () => string | null | Promise<string | null>;

/**
 * Called when a request returns 401. The implementation is expected to
 * refresh the token (e.g. by re-registering the device) and return
 * <c>true</c> if a fresh token is now available; the failed request
 * will then be retried once.
 */
export type OnUnauthorized = () => Promise<boolean>;

export interface NagApiClientOptions {
  baseUrl: string;
  /**
   * Per-request bearer source. Returning `null` omits the
   * `Authorization` header entirely — appropriate for the bootstrap
   * flow before any device token has been issued, where anonymous
   * endpoints (`/devices/register`, `/devices/pair`,
   * `/accounts/upgrade`, `/health`) still work.
   */
  getToken: GetToken;
  /**
   * Optional 401 hook. When provided, every request that comes back
   * with a 401 status is retried exactly once after this callback
   * resolves to `true`. Re-entry is suppressed via a per-config flag.
   */
  onUnauthorized?: OnUnauthorized;
  /** Per-request timeout in ms (applied to the underlying axios instance). */
  timeoutMs?: number;
  /**
   * Zodios validation mode. Defaults to zodios's default (validate
   * everything). Pass `"none"` or `false` to skip validation when you
   * want to observe whatever the server actually returned.
   */
  validate?: NagApiValidate;
}

type RetriedConfig = InternalAxiosRequestConfig & { __nagRetried?: boolean };

/**
 * Zodios-backed client over the generated `endpoints` array.
 *
 * Uses axios's default adapter — XHR on React Native (stable against
 * HTTP + localhost), native http/https on Node. Request body and
 * response body validation is on by default; opt out via `validate`.
 */
export const createNagApiClient = ({
  baseUrl,
  getToken,
  onUnauthorized,
  timeoutMs = 30_000,
  validate,
}: NagApiClientOptions) => {
  const axiosInstance = axios.create({ timeout: timeoutMs });

  axiosInstance.interceptors.request.use(async (config) => {
    const token = await getToken();
    const headers = AxiosHeaders.from(config.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }
    config.headers = headers;
    return config;
  });

  if (onUnauthorized) {
    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        if (!isAxiosError(error) || error.response?.status !== 401) {
          throw error;
        }
        const config = error.config as RetriedConfig | undefined;
        if (!config || config.__nagRetried) {
          throw error;
        }
        const refreshed = await onUnauthorized();
        if (!refreshed) {
          throw error;
        }
        config.__nagRetried = true;
        return axiosInstance.request(config);
      },
    );
  }

  const api = new Zodios(baseUrl, endpoints, {
    axiosInstance,
    ...(validate !== undefined ? { validate } : {}),
  });
  return api;
};

export type NagApiClient = ReturnType<typeof createNagApiClient>;
