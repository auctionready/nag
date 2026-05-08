import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { timestamp } from "../columns";

/**
 * Single-row table (`id = 1`) holding this device's identity.
 *
 *   - `deviceId` is generated locally on first launch and never changes;
 *     re-registration is idempotent on it server-side.
 *   - `accountId` and `registeredAt` land once `POST /devices/register`
 *     succeeds. Until they do, the outbox dispatcher refuses to ship — the
 *     app stays usable, just disconnected from the server.
 *   - `idpSubject` records the Clerk identity (`user_xxx`) that the most
 *     recent successful `/accounts/upgrade` bound this device to. It's a
 *     public identifier (not a credential), so it lives here and not in
 *     SecureStore. Used to short-circuit the upgrade call on cold start
 *     when we've already upgraded for the currently-signed-in identity;
 *     cleared on sign-out.
 *
 * Stored as TEXT (not BLOB) — there's only ever one row, so the
 * BLOB index-compactness win doesn't apply.
 *
 * The per-device bearer token returned alongside `accountId` is **not**
 * stored here — it's a credential and goes in platform-secure storage
 * (Keychain on iOS, EncryptedSharedPreferences on Android) via the
 * `TokenStore` injected into `ensureDeviceRegistered`.
 */
export const identity = sqliteTable("identity", {
  id: integer("id", { mode: "number" }).primaryKey().default(1),
  deviceId: text("device_id", { length: 36 }).notNull(),
  accountId: text("account_id", { length: 36 }),
  registeredAt: timestamp("registered_at"),
  idpSubject: text("idp_subject"),
});
