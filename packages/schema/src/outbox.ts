import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";
import { safeDefault } from "./safeDefault";

export const outboxStatuses = ["pending", "sent", "failed"] as const;
export type OutboxStatus = (typeof outboxStatuses)[number];

/**
 * Outbox queue for commands committed locally but not yet acknowledged by
 * the server. Rows with `status = 'pending'` are what the dispatcher ships;
 * `envelopeId` is the idempotency key the server uses to dedupe retries.
 * `serverSequence` records the per-account sequence the server assigned on
 * acceptance, used by pull-sync to advance the high-water mark.
 */
export const outbox = sqliteTable("outbox", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  envelopeId: text("envelope_id")
    .notNull()
    .unique()
    .$defaultFn(safeDefault("outbox.envelopeId", () => crypto.randomUUID())),
  commandType: text("command_type").notNull(),
  payload: text("payload"),
  timestamp: isoTimestamp("timestamp")
    .notNull()
    .$defaultFn(() => new Date()),
  status: text("status", { enum: outboxStatuses }).notNull().default("pending"),
  sentAt: isoTimestamp("sent_at"),
  serverSequence: integer("server_sequence", { mode: "number" }),
  lastError: text("last_error"),
});
