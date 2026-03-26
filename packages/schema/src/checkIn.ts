import { pgTable, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { habit } from "./habit.js";

export const checkIn = pgTable("check_in", {
  id: uuid("id").defaultRandom().primaryKey(),
  habitId: uuid("habit_id").notNull().references(() => habit.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("check_in_habit_id_idx").on(table.habitId),
  index("check_in_timestamp_idx").on(table.timestamp),
]);

export const checkInRelations = relations(checkIn, ({ one }) => ({
  habit: one(habit, {
    fields: [checkIn.habitId],
    references: [habit.id],
  }),
}));
