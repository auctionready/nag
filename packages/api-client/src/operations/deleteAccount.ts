import { isErrorFromAlias, type ZodiosResponseByAlias } from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

export type DeleteAccountResult =
  | { ok: true; accountId: string }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type DeleteAccountResponse = ZodiosResponseByAlias<
  Endpoints,
  "deleteAccountsMe"
>;

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
    const response: DeleteAccountResponse =
      await client.deleteAccountsMe(undefined);
    const elapsed = Date.now() - start;
    if (!response.accountId) {
      log?.error?.(
        `DELETE /accounts/me ok (${elapsed}ms) but response missing accountId`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete DeleteAccountResponse",
      };
    }
    log?.info?.(
      `DELETE /accounts/me ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return { ok: true, accountId: response.accountId };
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
