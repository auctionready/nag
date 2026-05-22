import {
  isErrorFromAlias,
  type ZodiosBodyByAlias,
  type ZodiosResponseByAlias,
} from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

export type RegisterDeviceResult =
  | {
      ok: true;
      accountId: string;
      registeredAt: Date;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type RegisterDeviceBody = ZodiosBodyByAlias<Endpoints, "postDevicesRegister">;
type RegisterDeviceResponse = ZodiosResponseByAlias<
  Endpoints,
  "postDevicesRegister"
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
  log?.debug?.(`POST /devices deviceId=${request.deviceId}`);
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
        `POST /devices ok (${elapsed}ms) but response missing fields`,
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
      `POST /devices ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return {
      ok: true,
      accountId: response.accountId,
      registeredAt: response.registeredAt,
      deviceToken: response.deviceToken,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /devices",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postDevicesRegister", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
