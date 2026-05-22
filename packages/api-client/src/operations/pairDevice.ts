import {
  isErrorFromAlias,
  type ZodiosBodyByAlias,
  type ZodiosResponseByAlias,
} from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

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
  log?.debug?.(`POST /accounts/me/devices deviceId=${request.deviceId}`);
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
        `POST /accounts/me/devices ok (${elapsed}ms) but response missing fields`,
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
      `POST /accounts/me/devices ok (${elapsed}ms) accountId=${response.accountId}`,
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
      "POST /accounts/me/devices",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postDevicesPair", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
