import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import type { AnyDb } from "../db";
import type { RegisterDeviceFn, RegisterDeviceResult } from "./types";

export type IdentityRow = {
  deviceId: string;
  accountId: string | null;
  registeredAt: Date | null;
};

export const loadIdentity = async (db: AnyDb): Promise<IdentityRow | null> => {
  const [row] = await db
    .select({
      deviceId: identity.deviceId,
      accountId: identity.accountId,
      registeredAt: identity.registeredAt,
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
 * Platform-secure persistent storage for the per-device bearer token —
 * iOS Keychain via `expo-secure-store` on the mobile client, an
 * in-memory implementation in tests. Never store the token in SQLite:
 * the token is a credential and belongs in hardware-backed storage,
 * out of regular app-data backups.
 */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export type EnsureDeviceRegisteredOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
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
 *     `POST /devices/register`, stores the returned `accountId` in
 *     SQLite and the `deviceToken` in `tokenStore`.
 *   - Subsequent launches with `accountId` set and `tokenStore.get()`
 *     yielding a value: no-op (returns immediately).
 *   - Subsequent launches missing either piece (previous attempt failed,
 *     or upgrading from a pre-token install where SQLite has an
 *     accountId but the secure store is empty): reuses the persisted
 *     `deviceId` and retries — the server is idempotent on `deviceId`,
 *     so retries are safe and produce a fresh token.
 *
 * Failures don't throw — the function returns with `accountId: null` and a
 * `registration` object describing what happened. The outbox dispatcher
 * checks `accountId` and refuses to ship until it's populated.
 */
export const ensureDeviceRegistered = async ({
  db,
  tokenStore,
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
    row = { deviceId, accountId: null, registeredAt: null };
  }

  const cachedToken = row.accountId ? await tokenStore.get() : null;
  if (row.accountId && cachedToken) {
    debug(`identity: already registered accountId=${row.accountId}`);
    return {
      deviceId: row.deviceId,
      accountId: row.accountId,
      deviceToken: cachedToken,
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
      })
      .where(eq(identity.id, 1));
    await tokenStore.set(result.deviceToken);
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
  tokenStore: TokenStore;
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
  tokenStore,
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
    })
    .where(eq(identity.id, 1));
  await tokenStore.set(result.deviceToken);

  info(`identity: token refreshed accountId=${result.accountId}`);
  return result.deviceToken;
};
