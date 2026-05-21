import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

/**
 * Single-row table (`id = 1`) tracking app-wide sync flags.
 *
 *   - `halted` is set by the outbox dispatcher when a non-retriable
 *     4xx is received; cleared by the user-facing "Resume sync" action.
 *     Carries an implicit error story — used to render the red
 *     "Not syncing right now" banner.
 *   - `paused` is set by the user via the sign-out dialog's
 *     "Pause server sync" option. Unlike `halted` it carries no error
 *     and stays set indefinitely until the user explicitly resumes.
 *     The dispatcher + pull-sync check both flags before running, so
 *     either being true stops sync; resume clears whichever is set.
 *     Kept distinct from `halted` so the UI can surface a calm
 *     "Sync paused" affordance rather than the alarming
 *     "Not syncing right now" treatment.
 *   - `highestServerSequence` is the high-water mark for pull-sync:
 *     the largest per-account `sequence` we've ever observed (from a
 *     successful POST /commands or a GET /sync replay/snapshot apply).
 */
export const syncState = sqliteTable("sync_state", {
  id: integer("id", { mode: "number" }).primaryKey().default(1),
  halted: integer("halted", { mode: "boolean" }).notNull().default(false),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  highestServerSequence: integer("highest_server_sequence", { mode: "number" })
    .notNull()
    .default(0),
});
