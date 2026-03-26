import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { habit } from "./habit";

export const checkIn = sqliteTable("check_in", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id", { mode: "number" }).notNull().references(() => habit.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("check_in_habit_id_idx").on(table.habitId),
  index("check_in_timestamp_idx").on(table.timestamp),
]);
