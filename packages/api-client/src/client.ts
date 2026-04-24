import axios, { type AxiosAdapter } from "axios";
import { Zodios, headerPlugin } from "@zodios/core";
import { endpoints } from "./endpoint-definition";

export interface NagApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-request timeout in ms (applied to the underlying axios instance). */
  timeoutMs?: number;
  /**
   * Optional axios adapter override.
   *
   * Defaults to **undefined** (axios auto-picks: XHR on React Native,
   * native http/https on Node). An earlier revision hardcoded
   * `"fetch"`, which caused RN's fetch polyfill to silently hang
   * against HTTP + localhost + chunked-transfer responses on the iOS
   * simulator. XHR is the actual native transport underneath RN's
   * fetch and is stable for this path.
   *
   * Tests that mock `global.fetch` should pass `"fetch"` here so they
   * continue to work without rewiring to an XHR/http mocker.
   */
  adapter?: "fetch" | "xhr" | "http" | AxiosAdapter;
}

/**
 * Zodios-backed client over the generated `endpoints` array.
 *
 * Zodios runs zod validation on both request bodies (pre-send) and
 * response bodies (post-receive), so callers get typed methods with
 * contract enforcement baked in.
 */
export const createNagApiClient = ({
  baseUrl,
  apiKey,
  timeoutMs = 20_000,
  adapter,
}: NagApiClientOptions) => {
  const axiosInstance = axios.create({
    timeout: timeoutMs,
    ...(adapter ? { adapter } : {}),
  });
  const api = new Zodios(baseUrl, endpoints, { axiosInstance });
  api.use(headerPlugin("Authorization", `Bearer ${apiKey}`));
  return api;
};

export type NagApiClient = ReturnType<typeof createNagApiClient>;
