import { isErrorFromAlias } from "@zodios/core";
import { endpoints } from "../endpoint-definition";
import type { NagApiClient } from "../client";
import { failureFromError, type WrapperLog } from "./shared";

export type ReleaseClerkIdentityResult =
  | { ok: true }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * DELETEs the account-to-Clerk-identity binding owned by whatever
 * account currently holds the verified <c>sub</c>. The caller proves
 * ownership via a valid Clerk JWT in the body. Idempotent: 204 even if
 * no account is currently bound.
 *
 * Used by the "use this device's data" take-over flow: after
 * <c>POST /accounts/me/identity</c> returns 409 ("this identity is
 * already bound to a different account"), call this to free the
 * binding, then re-try the upgrade.
 */
export const releaseClerkIdentity = async (
  client: NagApiClient,
  request: { idpToken: string },
  log?: WrapperLog,
): Promise<ReleaseClerkIdentityResult> => {
  log?.debug?.("DELETE /accounts/by-clerk-identity");
  const start = Date.now();
  try {
    await client.deleteAccountsByClerkIdentity(request);
    const elapsed = Date.now() - start;
    log?.info?.(`DELETE /accounts/by-clerk-identity ok (${elapsed}ms)`);
    return { ok: true };
  } catch (error: unknown) {
    return failureFromError(
      "DELETE /accounts/by-clerk-identity",
      log,
      Date.now() - start,
      error,
      () => {
        if (
          isErrorFromAlias(endpoints, "deleteAccountsByClerkIdentity", error)
        ) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
