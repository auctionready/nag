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
      idpSubject: string;
      upgradedAt: Date;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type SetIdentityBody = ZodiosBodyByAlias<Endpoints, "postAccountsMeIdentity">;
type SetIdentityResponse = ZodiosResponseByAlias<
  Endpoints,
  "postAccountsMeIdentity"
>;

const upgradeAccountOnce = async (
  client: NagApiClient,
  request: { idpToken: string },
  log: WrapperLog | undefined,
): Promise<UpgradeAccountResult> => {
  const start = Date.now();
  try {
    const response: SetIdentityResponse = await client.postAccountsMeIdentity(
      request as SetIdentityBody,
    );
    const elapsed = Date.now() - start;
    if (!response.idpSubject || !response.upgradedAt) {
      log?.error?.(
        `POST /accounts/me/identity ok (${elapsed}ms) but response missing fields`,
        response,
      );
      return {
        ok: false,
        kind: "non-retriable",
        status: 200,
        message: "server returned an incomplete AccountIdentity",
      };
    }
    log?.info?.(
      `POST /accounts/me/identity ok (${elapsed}ms) sub=${response.idpSubject}`,
    );
    return {
      ok: true,
      idpSubject: response.idpSubject,
      upgradedAt: response.upgradedAt,
    };
  } catch (error: unknown) {
    return failureFromError(
      "POST /accounts/me/identity",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postAccountsMeIdentity", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
      // 409 is the documented "identity already bound to a different
      // account" / "account already bound to a different identity"
      // response; the conflict-resolution flow in account.tsx handles it
      // (by calling releaseClerkIdentity then retrying this endpoint).
      [409],
    );
  }
};

/**
 * POSTs the calling account's identity binding — sets <c>IdpSubject</c>
 * from the verified Clerk JWT's <c>sub</c>. Caller must already hold a
 * device token (from <c>/devices/register</c>); the server reads
 * <c>accountId</c> and <c>deviceId</c> from claims.
 *
 * Idempotent server-side on <c>(account, sub)</c>, so re-attempting
 * after a transient failure is safe; the server returns 200 with the
 * existing <c>UpgradedAt</c> if the identity already matches.
 *
 * Auto-retries up to 2 extra times on transient failures (5xx, 408/425/429,
 * network/timeout). The Lambda's first cold call can run ~19s while it
 * fetches Clerk's JWKS, validates the JWT, and warms Marten — well within
 * the 30s axios timeout but occasionally clipping it. Subsequent attempts
 * hit a warm container and complete in <1s.
 */
export const upgradeAccount = async (
  client: NagApiClient,
  request: { idpToken: string },
  log?: WrapperLog,
): Promise<UpgradeAccountResult> => {
  log?.debug?.("POST /accounts/me/identity");

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
        `POST /accounts/me/identity transient attempt ${attempt}/${maxAttempts} (${last.message}) — retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return last;
};
