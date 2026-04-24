import axios from "axios";
import { Zodios, headerPlugin } from "@zodios/core";
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

export interface NagApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-request timeout in ms (applied to the underlying axios instance). */
  timeoutMs?: number;
  /**
   * Zodios validation mode. Defaults to zodios's default (validate
   * everything). Pass `"none"` or `false` to skip validation when you
   * want to observe whatever the server actually returned.
   */
  validate?: NagApiValidate;
}

/**
 * Zodios-backed client over the generated `endpoints` array.
 *
 * Uses axios's default adapter — XHR on React Native (stable against
 * HTTP + localhost), native http/https on Node. Request body and
 * response body validation is on by default; opt out via `validate`.
 */
export const createNagApiClient = ({
  baseUrl,
  apiKey,
  timeoutMs = 20_000,
  validate,
}: NagApiClientOptions) => {
  const axiosInstance = axios.create({ timeout: timeoutMs });
  const api = new Zodios(baseUrl, endpoints, {
    axiosInstance,
    ...(validate !== undefined ? { validate } : {}),
  });
  api.use(headerPlugin("Authorization", `Bearer ${apiKey}`));
  return api;
};

export type NagApiClient = ReturnType<typeof createNagApiClient>;
