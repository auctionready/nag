import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import type { AnyDb } from "../db";
import { clearHalted } from "../sync/outbox";
import { loadIdentity } from "./identity";
import type { EnsureDeviceRegisteredOptions, TokenStore } from "./identity";
import type { DevTokenResult, FetchDevTokenFn } from "./types";

export type EnsureDevAuthRegisteredOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
  fetchDevToken: FetchDevTokenFn;
  log?: EnsureDeviceRegisteredOptions["log"];
};

export type EnsureDevAuthRegisteredResult = {
  deviceId: string;
  accountId: string | null;
  deviceToken: string | null;
  result: DevTokenResult | { ok: true; cached: true } | null;
};

/**
 * Dev-auth analogue of `ensureDeviceRegistered`: mints a token via the
 * backend's `GET /dev/token` (HMAC-signed, fixed account/device pair —
 * the same one SwaggerDevAuth uses) and pins the local identity row to
 * the server-supplied GUIDs. Unlike `ensureDeviceRegistered`, this
 * **overwrites** the local `deviceId` because dev-auth's pair is
 * dictated by the server config (`Nag__DeviceToken__DevAccountId/
 * DevDeviceId`), not chosen by the client.
 *
 * Idempotent: if the identity row already has the dev `accountId` AND
 * the secure store still holds a token, returns immediately. Otherwise
 * calls `/dev/token`, persists the result, and clears any sync halt.
 *
 * Failures don't throw — caller decides what to do (typically log + let
 * the user fix via the dev menu).
 *
 * Lives in its own file (and is re-exported from `@nag/core/dev`, not
 * the main `@nag/core` entry) so app builds that don't reach into the
 * dev-auth flow never pull this function — and its `/dev/token` URL —
 * into their production bundle.
 */
export const ensureDevAuthRegistered = async ({
  db,
  tokenStore,
  fetchDevToken,
  log,
}: EnsureDevAuthRegisteredOptions): Promise<EnsureDevAuthRegisteredResult> => {
  const debug = log?.debug ?? (() => {});
  const info = log?.info ?? (() => {});
  const warn = log?.warn ?? (() => {});

  const row = await loadIdentity(db);
  const cachedToken = row?.accountId ? await tokenStore.get() : null;
  if (row?.accountId && cachedToken) {
    debug(`identity: dev-auth already registered accountId=${row.accountId}`);
    return {
      deviceId: row.deviceId,
      accountId: row.accountId,
      deviceToken: cachedToken,
      result: { ok: true, cached: true },
    };
  }

  debug(`identity: requesting dev token`);
  const result = await fetchDevToken();

  if (result.ok) {
    info(`identity: dev-auth registered accountId=${result.accountId}`);
    const registeredAt = new Date();
    if (!row) {
      await db.insert(identity).values({
        id: 1,
        deviceId: result.deviceId,
        accountId: result.accountId,
        registeredAt,
      });
    } else {
      await db
        .update(identity)
        .set({
          deviceId: result.deviceId,
          accountId: result.accountId,
          registeredAt,
        })
        .where(eq(identity.id, 1));
    }
    await tokenStore.set(result.deviceToken);
    await clearHalted(db);
    return {
      deviceId: result.deviceId,
      accountId: result.accountId,
      deviceToken: result.deviceToken,
      result,
    };
  }

  const detail =
    result.kind === "non-retriable"
      ? `${result.status}: ${result.message}`
      : result.message;
  warn(`identity: dev-auth failed (${result.kind}) ${detail}`);
  return {
    deviceId: row?.deviceId ?? "",
    accountId: null,
    deviceToken: null,
    result,
  };
};
