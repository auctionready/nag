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
  registration: RegisterDeviceResult | { ok: true; cached: true } | null;
};

/**
 * Idempotent boot-time call: makes sure the local `identity` row exists,
 * then asks the server for an `accountId` if we don't already have one.
 *
 *   - First launch: generates a `deviceId`, persists it, calls
 *     `POST /devices/register`, stores the returned `accountId`.
 *   - Subsequent launches with `accountId` set: no-op (returns immediately).
 *   - Subsequent launches without `accountId` (previous attempt failed):
 *     reuses the persisted `deviceId` and retries — the server is idempotent
 *     on `deviceId`, so retries are safe.
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
    row = { deviceId, accountId: null, registeredAt: null };
  }

  if (row.accountId) {
    debug(`identity: already registered accountId=${row.accountId}`);
    return {
      deviceId: row.deviceId,
      accountId: row.accountId,
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
    return {
      deviceId: row.deviceId,
      accountId: result.accountId,
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
    registration: result,
  };
};
