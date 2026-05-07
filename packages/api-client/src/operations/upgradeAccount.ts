import {
  isErrorFromAlias,
  type ZodiosBodyByAlias,
  type ZodiosResponseByAlias,
} from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

export type UpgradeAccountResult =
  | {
      ok: true;
      accountId: string;
      idpSubject: string;
      upgradedAt: Date;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type UpgradeAccountBody = ZodiosBodyByAlias<Endpoints, "postAccountsUpgrade">;
type UpgradeAccountResponse = ZodiosResponseByAlias<
  Endpoints,
  "postAccountsUpgrade"
>;

const upgradeAccountOnce = async (
  client: NagApiClient,
  request: { deviceId: string; idpToken: string; force?: boolean },
  log: WrapperLog | undefined,
): Promise<UpgradeAccountResult> => {
  const start = Date.now();
  try {
    const response: UpgradeAccountResponse = await client.postAccountsUpgrade(
      request as UpgradeAccountBody,
    );
    const elapsed = Date.now() - start;
    if (
      !response.accountId ||
      !response.idpSubject ||
      !response.upgradedAt ||
      !response.deviceToken
    ) {
      log?.error?.(
        `POST /accounts/upgrade ok (${elapsed}ms) but response missing fields`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete UpgradeAccountResponse",
      };
    }
    log?.info?.(
      `POST /accounts/upgrade ok (${elapsed}ms) accountId=${response.accountId} sub=${response.idpSubject}`,
    );
    return {
      ok: true,
      accountId: response.accountId,
      idpSubject: response.idpSubject,
      upgradedAt: response.upgradedAt,
      deviceToken: response.deviceToken,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /accounts/upgrade",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postAccountsUpgrade", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
      // 409 is the documented "identity already bound to a different
      // account" / "account already bound to a different identity"
      // response; the conflict-resolution flow in account.tsx handles it.
      [409],
    );
  }
};

/**
 * POSTs an account-upgrade request — binds the calling device's anonymous
 * account to a Clerk-issued identity. Idempotent server-side on
 * `(account, sub)`, so re-attempting after a transient failure is safe;
 * the server returns 200 with the existing `UpgradedAt` if the
 * `(deviceId, sub)` pair already matches.
 *
 * Auto-retries up to 2 extra times on transient failures (5xx, 408/425/429,
 * network/timeout). The Lambda's first cold call can run ~19s while it
 * fetches Clerk's JWKS, validates the JWT, and warms Marten — well within
 * the 30s axios timeout but occasionally clipping it. Subsequent attempts
 * hit a warm container and complete in <1s.
 */
export const upgradeAccount = async (
  client: NagApiClient,
  request: { deviceId: string; idpToken: string; force?: boolean },
  log?: WrapperLog,
): Promise<UpgradeAccountResult> => {
  log?.debug?.(
    `POST /accounts/upgrade deviceId=${request.deviceId}${request.force ? " force=true" : ""}`,
  );

  const maxAttempts = 3;
  let last: UpgradeAccountResult = {
    ok: false,
    kind: "transient",
    message: "no attempts ran",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await upgradeAccountOnce(client, request, log);
    if (last.ok) return last;
    if (last.kind === "non-retriable") return last;
    if (attempt < maxAttempts) {
      const delayMs = 1000 * attempt;
      log?.warn?.(
        `POST /accounts/upgrade transient attempt ${attempt}/${maxAttempts} (${last.message}) — retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return last;
};
