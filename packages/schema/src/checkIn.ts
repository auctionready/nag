import { sqliteTable, integer, index } from "drizzle-orm/sqlite-core";
import { habit } from "./habit";
import { isoTimestamp } from "./isoTimestamp";

export const checkIn = sqliteTable("check_in", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id", { mode: "number" }).notNull().references(() => habit.id, { onDelete: "cascade" }),
  timestamp: isoTimestamp("timestamp").notNull().$defaultFn(() => new Date()),
  skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
  createdAt: isoTimestamp("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: isoTimestamp("updated_at").notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("check_in_habit_id_idx").on(table.habitId),
  index("check_in_timestamp_idx").on(table.timestamp),
]);
