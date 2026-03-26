import { pgTable, uuid, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { habit } from "./habit.js";
import { regularityEnum } from "./regularity.js";

export const goal = pgTable("goal", {
  id: uuid("id").defaultRandom().primaryKey(),
  habitId: uuid("habit_id").notNull().references(() => habit.id, { onDelete: "cascade" }),
  regularity: regularityEnum("regularity").notNull(),
  count: integer("count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
