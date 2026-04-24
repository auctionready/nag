import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";
import { safeDefault } from "./safeDefault";

export const auditLogStatuses = ["pending", "sent", "failed"] as const;
export type AuditLogStatus = (typeof auditLogStatuses)[number];

/**
 * Append-only log of commands that have been committed locally. Doubles as the
 * outbox: rows with `status = 'pending'` are what the dispatcher ships to the
 * server, in ascending `id` order. `envelopeId` is the idempotency key the
 * server uses to dedupe retries.
 */
export const auditLog = sqliteTable("audit_log", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  envelopeId: text("envelope_id")
    .notNull()
    .unique()
    .$defaultFn(safeDefault("auditLog.envelopeId", () => crypto.randomUUID())),
  commandType: text("command_type").notNull(),
  payload: text("payload"),
  timestamp: isoTimestamp("timestamp")
    .notNull()
    .$defaultFn(() => new Date()),
  status: text("status", { enum: auditLogStatuses })
    .notNull()
    .default("pending"),
  sentAt: isoTimestamp("sent_at"),
  serverSequence: integer("server_sequence", { mode: "number" }),
  lastError: text("last_error"),
});
