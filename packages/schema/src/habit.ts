import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { checkIn } from "./checkIn";
import { goal } from "./goal";

export const habit = sqliteTable("habit", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const habitRelations = relations(habit, ({ many }) => ({
  checkIns: many(checkIn),
  goals: many(goal),
}));
