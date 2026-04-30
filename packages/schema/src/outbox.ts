import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";
import { safeDefault } from "./safeDefault";

export const outboxStatuses = ["pending", "sent", "failed"] as const;
export type OutboxStatus = (typeof outboxStatuses)[number];

/**
 * Outbox queue for one-or-more past-tense events committed locally but not
 * yet acknowledged by the server. Each row is a single user-intent envelope:
 * `events` is the JSON-encoded `[{type, payload}, ...]` the dispatcher POSTs
 * to `/events` verbatim. `envelopeId` is the idempotency key the server uses
 * to dedupe retries. `serverSequence` records the per-account sequence the
 * server assigned on acceptance, used by pull-sync to advance the high-water
 * mark.
 */
export const outbox = sqliteTable("outbox", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  envelopeId: text("envelope_id")
    .notNull()
    .unique()
    .$defaultFn(safeDefault("outbox.envelopeId", () => crypto.randomUUID())),
  events: text("events").notNull(),
  timestamp: isoTimestamp("timestamp")
    .notNull()
    .$defaultFn(() => new Date()),
  status: text("status", { enum: outboxStatuses }).notNull().default("pending"),
  sentAt: isoTimestamp("sent_at"),
  serverSequence: integer("server_sequence", { mode: "number" }),
  lastError: text("last_error"),
});
