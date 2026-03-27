import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { isoTimestamp } from "./isoTimestamp";

export const habit = sqliteTable("habit", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
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
