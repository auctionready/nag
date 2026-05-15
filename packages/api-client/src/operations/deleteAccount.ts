import { isErrorFromAlias } from "@zodios/core";
import { endpoints } from "../endpoint-definition";
import type { NagApiClient } from "../client";
import { failureFromError, type WrapperLog } from "./shared";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * DELETE /accounts/me — wipes the calling account, every paired device,
 * the per-account read models, and every event tagged with the account's
 * tenant id. Server-side authoritative: the caller's account id comes
 * from the token, never the client. Existing device tokens become
 * useless after this resolves; the caller is expected to clear local
 * auth state and re-bootstrap if it wants to keep using the app.
 */
export const deleteAccount = async (
  client: NagApiClient,
  log?: WrapperLog,
): Promise<DeleteAccountResult> => {
  log?.debug?.("DELETE /accounts/me");
  const start = Date.now();
  try {
    await client.deleteAccountsMe(undefined);
    const elapsed = Date.now() - start;
    log?.info?.(`DELETE /accounts/me ok (${elapsed}ms)`);
    return { ok: true };
  } catch (error: unknown) {
    return failureFromError(
      "DELETE /accounts/me",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "deleteAccountsMe", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
