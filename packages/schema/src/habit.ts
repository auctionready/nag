import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";
import { safeDefault } from "./safeDefault";

export const habit = sqliteTable("habit", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  /**
   * Stable UUID used when the row is referenced in command envelopes shipped
   * to the server. Generated in JS at insert time; the column is enforced
   * NOT NULL + UNIQUE at the schema layer. Existing rows were backfilled by
   * migration 0008.
   */
  externalId: text("external_id")
    .notNull()
    .unique()
    .$defaultFn(safeDefault("habit.externalId", () => crypto.randomUUID())),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: isoTimestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: isoTimestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
