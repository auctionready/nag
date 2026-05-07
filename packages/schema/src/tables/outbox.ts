import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { uuid, timestamp } from "../columns";
import { seqUuid } from "../seqUuid";

export const outboxStatuses = ["pending", "sent", "failed"] as const;
export type OutboxStatus = (typeof outboxStatuses)[number];

/**
 * Outbox queue for one-or-more past-tense events committed locally but not
 * yet acknowledged by the server. Each row is a single user-intent envelope:
 * `events` is the JSON-encoded `[{type, payload}, ...]` the dispatcher POSTs
 * to `/events` verbatim. `id` doubles as the local PK and the wire-side
 * idempotency key the server uses to dedupe retries — UUIDv7 keeps it
 * monotonic so insertion-order reads stay cheap. `serverSequence` records
 * the per-account sequence the server assigned on acceptance, used by
 * pull-sync to advance the high-water mark.
 */
export const outbox = sqliteTable("outbox", {
  id: uuid("id").primaryKey().$defaultFn(seqUuid),
  events: text("events").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  status: text("status", { enum: outboxStatuses }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  serverSequence: integer("server_sequence", { mode: "number" }),
  lastError: text("last_error"),
});
