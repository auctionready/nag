import { isErrorFromAlias, type ZodiosResponseByAlias } from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

export type UnbindAccountResult =
  | { ok: true; accountId: string }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type UnbindAccountResponse = ZodiosResponseByAlias<
  Endpoints,
  "postAccountsUnbind"
>;

/**
 * POSTs an account-unbind request — clears the bound Clerk identity
 * (`IdpSubject` / `UpgradedAt`) on the calling device's account so the
 * next sign-in can rebind it to a different identity. Habit data is
 * untouched. Server-side idempotent: re-running on an already-anonymous
 * account is a 200 no-op, so retrying after a transient failure is safe.
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
  log?.debug?.("POST /accounts/unbind");
  const start = Date.now();
  try {
    const response: UnbindAccountResponse =
      await client.postAccountsUnbind(undefined);
    const elapsed = Date.now() - start;
    if (!response.accountId) {
      log?.error?.(
        `POST /accounts/unbind ok (${elapsed}ms) but response missing accountId`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete UnbindAccountResponse",
      };
    }
    log?.info?.(
      `POST /accounts/unbind ok (${elapsed}ms) accountId=${response.accountId}`,
    );
    return { ok: true, accountId: response.accountId };
  } catch (error: unknown) {
    return failureFromError(
      "POST /accounts/unbind",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postAccountsUnbind", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
