import axios from "axios";
import { Zodios, headerPlugin } from "@zodios/core";
import { endpoints } from "./endpoint-definition";

export interface NagApiClientOptions {
  baseUrl: string;
  apiKey: string;
}

/**
 * Zodios-backed client over the generated `endpoints` array. Uses fetch as
 * the transport (via axios's `adapter: "fetch"`) and injects the bearer
 * token through a zodios plugin, so callers only see typed methods.
 */
export const createNagApiClient = ({
  baseUrl,
  apiKey,
}: NagApiClientOptions) => {
  const axiosInstance = axios.create({ adapter: "fetch" });
  const api = new Zodios(baseUrl, endpoints, { axiosInstance });
  api.use(headerPlugin("Authorization", `Bearer ${apiKey}`));
  return api;
};

export type NagApiClient = ReturnType<typeof createNagApiClient>;
