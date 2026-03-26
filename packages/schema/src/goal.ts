import { sqliteTable, integer, text, index, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { habit } from "./habit.js";
import { regularityValues } from "./regularity.js";

export const goal = sqliteTable("goal", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  habitId: integer("habit_id", { mode: "number" }).notNull().references(() => habit.id, { onDelete: "cascade" }),
  regularity: text("regularity", { enum: regularityValues }).notNull(),
  count: integer("count").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("goal_habit_id_idx").on(table.habitId),
  unique("goal_habit_regularity_uniq").on(table.habitId, table.regularity),
]);

export const goalRelations = relations(goal, ({ one }) => ({
  habit: one(habit, {
    fields: [goal.habitId],
    references: [habit.id],
  }),
}));
