import { isErrorFromAlias } from "@zodios/core";
import { endpoints } from "../endpoint-definition";
import type { NagApiClient } from "../client";
import { failureFromError, type WrapperLog } from "./shared";

export type UnregisterDeviceResult =
  | { ok: true }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * DELETE /devices/me — unpairs the calling device from its account.
 * If this was the last device on the account, the server cascades and
 * deletes the account too, so the server never holds an ownerless
 * account row. When other devices remain on the account, they keep
 * working through their own device tokens.
 *
 * Server-side idempotent: the underlying Device row may already be gone
 * (e.g. the previous attempt's response was lost in transit), in which
 * case the server still answers 204. A retry that hits the auth handler
 * with a token for an account/device that's already been cleared up
 * returns 401 — the caller should treat that as "already done" rather
 * than a real failure.
 *
 * Used by the "start a new account" branch of the sign-in conflict
 * flow, where the device's local data is about to be flushed into a
 * brand-new server account: clearing the old binding here means the
 * subsequent `/devices/register` creates a fresh account+device pair
 * with no link back to the previous identity.
 */
export const unregisterDevice = async (
  client: NagApiClient,
  log?: WrapperLog,
): Promise<UnregisterDeviceResult> => {
  log?.debug?.("DELETE /devices/me");
  const start = Date.now();
  try {
    await client.deleteDevicesMe(undefined);
    const elapsed = Date.now() - start;
    log?.info?.(`DELETE /devices/me ok (${elapsed}ms)`);
    return { ok: true };
  } catch (error: unknown) {
    return failureFromError(
      "DELETE /devices/me",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "deleteDevicesMe", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
