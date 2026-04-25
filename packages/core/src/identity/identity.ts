import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import type { AnyDb } from "../db";
import type { RegisterDeviceFn, RegisterDeviceResult } from "./types";

export type IdentityRow = {
  deviceId: string;
  accountId: string | null;
  registeredAt: Date | null;
  deviceToken: string | null;
};

export const loadIdentity = async (db: AnyDb): Promise<IdentityRow | null> => {
  const [row] = await db
    .select({
      deviceId: identity.deviceId,
      accountId: identity.accountId,
      registeredAt: identity.registeredAt,
      deviceToken: identity.deviceToken,
    })
    .from(identity)
    .where(eq(identity.id, 1));
  return row ?? null;
};

export const getAccountId = async (db: AnyDb): Promise<string | null> => {
  const row = await loadIdentity(db);
  return row?.accountId ?? null;
};

/**
 * Reads the persisted device token without going through the full
 * identity row. Used as the per-request bearer source by the API
 * client; returns `null` until `ensureDeviceRegistered` has run
 * successfully at least once.
 */
export const getDeviceToken = async (db: AnyDb): Promise<string | null> => {
  const row = await loadIdentity(db);
  return row?.deviceToken ?? null;
};

export type EnsureDeviceRegisteredOptions = {
  db: AnyDb;
  register: RegisterDeviceFn;
  /**
   * Source of the device id used on first launch. Pulled out so tests can
   * inject a deterministic value without touching the global `crypto`.
   */
  newDeviceId?: () => string;
  log?: {
    debug?: (msg: string, ...args: unknown[]) => void;
    info?: (msg: string, ...args: unknown[]) => void;
    warn?: (msg: string, ...args: unknown[]) => void;
    error?: (msg: string, ...args: unknown[]) => void;
  };
};

export type EnsureDeviceRegisteredResult = {
  deviceId: string;
  accountId: string | null;
  deviceToken: string | null;
  registration: RegisterDeviceResult | { ok: true; cached: true } | null;
};

/**
 * Idempotent boot-time call: makes sure the local `identity` row exists,
 * then asks the server for an `accountId` if we don't already have one.
 *
 *   - First launch: generates a `deviceId`, persists it, calls
 *     `POST /devices/register`, stores the returned `accountId` and
 *     `deviceToken`.
 *   - Subsequent launches with `accountId` and `deviceToken` set: no-op
 *     (returns immediately).
 *   - Subsequent launches missing either field (previous attempt failed,
 *     or upgrading from a pre-token install): reuses the persisted
 *     `deviceId` and retries — the server is idempotent on `deviceId`,
 *     so retries are safe and produce a fresh token.
 *
 * Failures don't throw — the function returns with `accountId: null` and a
 * `registration` object describing what happened. The outbox dispatcher
 * checks `accountId` and refuses to ship until it's populated.
 */
export const ensureDeviceRegistered = async ({
  db,
  register,
  newDeviceId = () => crypto.randomUUID(),
  log,
}: EnsureDeviceRegisteredOptions): Promise<EnsureDeviceRegisteredResult> => {
  const debug = log?.debug ?? (() => {});
  const info = log?.info ?? (() => {});
  const warn = log?.warn ?? (() => {});

  let row = await loadIdentity(db);
  if (!row) {
    const deviceId = newDeviceId();
    debug(`identity: first launch — generated deviceId=${deviceId}`);
    await db.insert(identity).values({ id: 1, deviceId });
    row = {
      deviceId,
      accountId: null,
      registeredAt: null,
      deviceToken: null,
    };
  }

  if (row.accountId && row.deviceToken) {
    debug(`identity: already registered accountId=${row.accountId}`);
    return {
      deviceId: row.deviceId,
      accountId: row.accountId,
      deviceToken: row.deviceToken,
      registration: { ok: true, cached: true },
    };
  }

  debug(`identity: registering deviceId=${row.deviceId}`);
  const result = await register({ deviceId: row.deviceId });

  if (result.ok) {
    info(`identity: registered accountId=${result.accountId}`);
    await db
      .update(identity)
      .set({
        accountId: result.accountId,
        registeredAt: result.registeredAt,
        deviceToken: result.deviceToken,
      })
      .where(eq(identity.id, 1));
    return {
      deviceId: row.deviceId,
      accountId: result.accountId,
      deviceToken: result.deviceToken,
      registration: result,
    };
  }

  const detail =
    result.kind === "non-retriable"
      ? `${result.status}: ${result.message}`
      : result.message;
  warn(`identity: registration failed (${result.kind}) ${detail}`);
  return {
    deviceId: row.deviceId,
    accountId: null,
    deviceToken: null,
    registration: result,
  };
};

export type RefreshDeviceTokenOptions = {
  db: AnyDb;
  register: RegisterDeviceFn;
  log?: EnsureDeviceRegisteredOptions["log"];
};

/**
 * Forces a re-registration to refresh the persisted `deviceToken` after
 * the server rejects the current one (typically a 401 caused by the
 * server-side HMAC secret rotating). The persisted `deviceId` is reused
 * — `POST /devices/register` is idempotent on it — so the same account
 * keeps the same id, just with fresh credentials.
 *
 * Returns the new token on success, or `null` if registration failed
 * (caller should give up on the in-flight request).
 */
export const refreshDeviceToken = async ({
  db,
  register,
  log,
}: RefreshDeviceTokenOptions): Promise<string | null> => {
  const debug = log?.debug ?? (() => {});
  const info = log?.info ?? (() => {});
  const warn = log?.warn ?? (() => {});

  const row = await loadIdentity(db);
  if (!row) {
    warn(`identity: refresh requested but no identity row exists`);
    return null;
  }

  debug(`identity: refreshing token for deviceId=${row.deviceId}`);
  const result = await register({ deviceId: row.deviceId });
  if (!result.ok) {
    warn(`identity: token refresh failed (${result.kind})`);
    return null;
  }

  await db
    .update(identity)
    .set({
      accountId: result.accountId,
      registeredAt: result.registeredAt,
      deviceToken: result.deviceToken,
    })
    .where(eq(identity.id, 1));

  info(`identity: token refreshed accountId=${result.accountId}`);
  return result.deviceToken;
};
