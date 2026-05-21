import { eq } from "drizzle-orm";
import {
  identity,
  habit,
  goal,
  schedule,
  checkIn,
  outbox,
  syncState,
  seqUuid,
} from "@nag/schema";
import type { AnyDb } from "../db";
import { withTransaction } from "../db/transaction";
import { clearHalted } from "../sync/outbox";
import type { RegisterDeviceFn, RegisterDeviceResult } from "./types";

export type IdentityRow = {
  deviceId: string;
  accountId: string | null;
  registeredAt: Date | null;
  idpSubject: string | null;
};

export const loadIdentity = async (db: AnyDb): Promise<IdentityRow | null> => {
  const [row] = await db
    .select({
      deviceId: identity.deviceId,
      accountId: identity.accountId,
      registeredAt: identity.registeredAt,
      idpSubject: identity.idpSubject,
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
 * Records that the most recent successful `/accounts/upgrade` bound this
 * device to the given Clerk identity. The app reads this on cold start to
 * skip a redundant upgrade call when the currently signed-in identity
 * matches what's already stored.
 */
export const setIdpSubject = async (
  db: AnyDb,
  idpSubject: string,
): Promise<void> => {
  await db.update(identity).set({ idpSubject }).where(eq(identity.id, 1));
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
  newDeviceId = seqUuid,
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
    row = { deviceId, accountId: null, registeredAt: null, idpSubject: null };
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
    // A successful registration is proof that the server is reachable
    // and accepts our credential — any sticky halt from a previous
    // 4xx (e.g. an early POST against an empty/rebuilt backend before
    // the account materialised) should not block the dispatcher now.
    await clearHalted(db);
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
  // Same rationale as ensureDeviceRegistered: a successful refresh
  // means we have a working credential, so unstick any prior halt.
  await clearHalted(db);

  info(`identity: token refreshed accountId=${result.accountId}`);
  return result.deviceToken;
};

export type SwitchLocalAccountOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
  newAccountId: string;
  newDeviceToken: string;
  registeredAt: Date;
  log?: EnsureDeviceRegisteredOptions["log"];
};

/**
 * Re-points the local install at a different `accountId` after the user
 * signs in on a device that had previously been registered as its own
 * anonymous account (the typical second-device flow). Replicated tables
 * (`habit`/`goal`/`schedule`/`checkIn`) and the outbox are wiped, and
 * `sync_state` is reset to `since=0` so the next pull-sync requests a
 * fresh snapshot from the new account.
 *
 * The `deviceId` is intentionally left untouched: the server's
 * `/devices/pair` call re-parents the existing Device row rather than
 * issuing a new id, so the local id stays valid. The new device token
 * (signed for the new accountId) is written to `tokenStore` *after* the
 * SQLite transaction commits — secure-store writes aren't transactional,
 * but this ordering means a crash leaves us with a stale token plus
 * fresh data, which `apiClient.onUnauthorized` already heals via
 * `refreshDeviceToken`.
 */
export const switchLocalAccount = async ({
  db,
  tokenStore,
  newAccountId,
  newDeviceToken,
  registeredAt,
  log,
}: SwitchLocalAccountOptions): Promise<void> => {
  const info = log?.info ?? (() => {});

  await withTransaction(db, async () => {
    await db.delete(checkIn);
    await db.delete(schedule);
    await db.delete(goal);
    await db.delete(habit);
    await db.delete(outbox);
    await db
      .update(syncState)
      .set({ halted: false, paused: false, highestServerSequence: 0 })
      .where(eq(syncState.id, 1));
    await db
      .update(identity)
      .set({ accountId: newAccountId, registeredAt })
      .where(eq(identity.id, 1));
  });

  await tokenStore.set(newDeviceToken);
  info(`identity: switched local account to accountId=${newAccountId}`);
};

export type ClearLocalAuthOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
  log?: EnsureDeviceRegisteredOptions["log"];
};

/**
 * Tears down the local "I'm registered with the server" state when the
 * user signs out, while keeping every locally-replicated row in place.
 *
 * Clears:
 *   - `identity.accountId` / `identity.registeredAt` (so dispatcher and
 *     pull-sync no-op until the next sign-in re-registers the device)
 *   - the secure-store device token (so a stale token can't keep talking
 *     to the server in the background)
 *
 * Preserves:
 *   - `identity.deviceId` — so the next sign-in calls `POST /devices/register`
 *     with the same id, hits the server's idempotent re-registration path,
 *     and rejoins the same Account
 *   - `habit`/`goal`/`schedule`/`checkIn` — the user's data survives sign-out
 *   - `outbox` and `syncState` — pending events stay queued and resume
 *     shipping once the user re-signs-in (or stay forever if they never do,
 *     which is fine: dispatcher just never runs)
 *
 * Distinct from `switchLocalAccount` which *moves* the device to a
 * different account and therefore wipes the replicated tables to avoid
 * leaking the previous account's data.
 */
export const clearLocalAuth = async ({
  db,
  tokenStore,
  log,
}: ClearLocalAuthOptions): Promise<void> => {
  const info = log?.info ?? (() => {});
  await db
    .update(identity)
    .set({ accountId: null, registeredAt: null, idpSubject: null })
    .where(eq(identity.id, 1));
  await tokenStore.clear();
  info("identity: cleared local auth — sign-in will re-register");
};

export type ResetLocalAccountOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
  log?: EnsureDeviceRegisteredOptions["log"];
};

/**
 * Wipes every locally-replicated row and deletes the identity row in
 * full so the next launch mints a brand-new `deviceId`. Used by the
 * "Sign out completely" branch of the sign-out dialog: dropping the
 * `deviceId` is what cuts the takeover vector, since otherwise a
 * subsequent `POST /devices/register` with the same id would idempotently
 * return the previous account's accountId and re-establish auth without
 * any proof the new caller was the legitimate owner.
 *
 * Clears:
 *   - `habit` / `goal` / `schedule` / `checkIn` (the replicated user data)
 *   - `outbox` (events queued for the previous account are now meaningless)
 *   - `syncState` (resets `highest_server_sequence` so a future pull-sync
 *     starts fresh)
 *   - the entire `identity` row, including `deviceId`
 *   - the secure-store device token
 *
 * Server-side state is left untouched. The previous account (and its
 * device row paired to the now-discarded `deviceId`) stay alive,
 * orphaned from this device. If the user signs back in with the same
 * identity, `runPairFallback` silently re-pairs the device's
 * freshly-minted row into the surviving account and the data
 * rehydrates from the server snapshot.
 *
 * Compare with:
 *   - `clearLocalAuth` (legacy soft sign-out — kept the deviceId, the
 *     takeover vector this helper closes)
 *   - `disconnectFromCloud` (the inverse: deletes the *server* account
 *     and preserves local data + outbox)
 *   - `switchLocalAccount` (wipes data but moves to a specific known
 *     `accountId` rather than tearing the identity row down)
 */
export const resetLocalAccount = async ({
  db,
  tokenStore,
  log,
}: ResetLocalAccountOptions): Promise<void> => {
  const info = log?.info ?? (() => {});
  await withTransaction(db, async () => {
    await db.delete(checkIn);
    await db.delete(schedule);
    await db.delete(goal);
    await db.delete(habit);
    await db.delete(outbox);
    await db
      .update(syncState)
      .set({ halted: false, paused: false, highestServerSequence: 0 })
      .where(eq(syncState.id, 1));
    await db.delete(identity).where(eq(identity.id, 1));
  });
  await tokenStore.clear();
  info(
    "identity: reset to fresh-install state — next launch mints a new deviceId",
  );
};

export type DisconnectFromCloudOptions = {
  db: AnyDb;
  tokenStore: TokenStore;
  log?: EnsureDeviceRegisteredOptions["log"];
};

/**
 * Releases the device's server-side binding while leaving every
 * locally-replicated row in place — the "Disconnect from cloud, keep
 * my data" action. Called after `DELETE /accounts/me` has wiped the
 * server-side account so the local mirror is now disconnected from a
 * dead account; scrubbing the identity row here keeps a future
 * sign-in's `/devices/register` from "rejoining" an account that no
 * longer exists.
 *
 * Same shape as `clearLocalAuth` (sign-out) plus a `sync_state` reset:
 * the old account's `highest_server_sequence` is meaningless once that
 * account is gone, and leaving it set would make pull-sync against
 * any future new account fail to replicate (the new account's
 * sequences start at 1, but pull would still ask `since=<old high>`).
 *
 * Crucially: every `'sent'` row in the outbox is reverted to
 * `'pending'` (clearing `sent_at` / `server_sequence` / `last_error`).
 * The next sign-in registers a brand-new server account; without
 * re-marking, the dispatcher would only ship rows queued *after*
 * disconnect, and the new account would silently miss every event
 * that had already been acknowledged by the previous (now-deleted)
 * account. Envelope ids are preserved so the re-ship is still
 * idempotent on the wire.
 *
 * Clears:
 *   - `identity.accountId` / `registeredAt` / `idpSubject`
 *   - the secure-store device token
 *   - `sync_state.highest_server_sequence` (back to 0, `halted` cleared)
 *   - outbox `sent_at` / `server_sequence` / `last_error` (status →
 *     `'pending'` on every previously-sent row)
 *
 * Preserves:
 *   - `identity.deviceId`
 *   - `habit` / `goal` / `schedule` / `checkIn` — the whole point
 *   - outbox `id` / `events` / `created_at` so the re-ship hits the
 *     server's idempotency dedupe with the same envelope ids
 *   - `'failed'` outbox rows are left as-is; the user must use the
 *     existing "Resume sync" action if they want those retried,
 *     since the reason for failure is usually intrinsic to the event
 *     payload and won't be cured by a fresh account
 */
export const disconnectFromCloud = async ({
  db,
  tokenStore,
  log,
}: DisconnectFromCloudOptions): Promise<void> => {
  const info = log?.info ?? (() => {});
  await withTransaction(db, async () => {
    await db
      .update(syncState)
      .set({ halted: false, paused: false, highestServerSequence: 0 })
      .where(eq(syncState.id, 1));
    await db
      .update(outbox)
      .set({
        status: "pending",
        sentAt: null,
        serverSequence: null,
        lastError: null,
      })
      .where(eq(outbox.status, "sent"));
    await db
      .update(identity)
      .set({ accountId: null, registeredAt: null, idpSubject: null })
      .where(eq(identity.id, 1));
  });
  await tokenStore.clear();
  info("identity: disconnected from cloud — local data preserved");
};
