import { isErrorFromAlias } from "@zodios/core";
import { endpoints } from "../endpoint-definition";
import type { NagApiClient } from "../client";
import { failureFromError, type WrapperLog } from "./shared";

export type UnbindAccountResult =
  | { ok: true }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * DELETEs the calling device's account-to-identity binding — clears
 * `IdpSubject` / `UpgradedAt` so the next sign-in can rebind it to a
 * different identity. Habit data is untouched. Server-side idempotent:
 * deleting an already-anonymous account's binding is a 204 no-op, so
 * retrying after a transient failure is safe.
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
  log?.debug?.("DELETE /accounts/me/identity");
  const start = Date.now();
  try {
    await client.deleteAccountsMeIdentity(undefined);
    const elapsed = Date.now() - start;
    log?.info?.(`DELETE /accounts/me/identity ok (${elapsed}ms)`);
    return { ok: true };
  } catch (error: unknown) {
    return failureFromError(
      "DELETE /accounts/me/identity",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "deleteAccountsMeIdentity", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
