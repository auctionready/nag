import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";

export const auditLog = sqliteTable("audit_log", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  commandType: text("command_type").notNull(),
  payload: text("payload"),
  timestamp: isoTimestamp("timestamp")
    .notNull()
    .$defaultFn(() => new Date()),
});
