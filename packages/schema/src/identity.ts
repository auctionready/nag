import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";

/**
 * Single-row table (`id = 1`) holding this device's identity.
 *
 *   - `deviceId` is generated locally on first launch and never changes;
 *     re-registration is idempotent on it server-side.
 *   - `accountId` and `registeredAt` land once `POST /devices/register`
 *     succeeds. Until they do, the outbox dispatcher refuses to ship — the
 *     app stays usable, just disconnected from the server.
 *   - `deviceToken` is the HMAC-signed bearer token the server returns
 *     alongside `accountId`. Sent as `Authorization: Bearer <token>` on
 *     every protected request. Refreshed on 401 by re-registering.
 */
export const identity = sqliteTable("identity", {
  id: integer("id", { mode: "number" }).primaryKey().default(1),
  deviceId: text("device_id").notNull(),
  accountId: text("account_id"),
  registeredAt: isoTimestamp("registered_at"),
  deviceToken: text("device_token"),
});
