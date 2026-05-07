import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

/**
 * Single-row table (`id = 1`) tracking app-wide sync flags. `halted` is set
 * by the outbox dispatcher when a non-retriable 4xx is received; only a
 * user-initiated "Resume sync" action clears it. `highestServerSequence`
 * is the high-water mark for pull-sync: the largest per-account `sequence`
 * we've ever observed (from a successful POST /commands or a GET /sync
 * replay/snapshot apply).
 */
export const syncState = sqliteTable("sync_state", {
  id: integer("id", { mode: "number" }).primaryKey().default(1),
  halted: integer("halted", { mode: "boolean" }).notNull().default(false),
  highestServerSequence: integer("highest_server_sequence", { mode: "number" })
    .notNull()
    .default(0),
});
