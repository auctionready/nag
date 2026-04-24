import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

/**
 * Single-row table (`id = 1`) tracking app-wide sync flags. `halted` is set
 * by the outbox dispatcher when a non-retriable 4xx is received; only a
 * user-initiated "Resume sync" action clears it.
 */
export const syncState = sqliteTable("sync_state", {
  id: integer("id", { mode: "number" }).primaryKey().default(1),
  halted: integer("halted", { mode: "boolean" }).notNull().default(false),
});
