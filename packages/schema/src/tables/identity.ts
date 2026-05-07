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
});
