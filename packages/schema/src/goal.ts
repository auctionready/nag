import {
  sqliteTable,
  integer,
  text,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { habit } from "./habit";
import { type Regularity, regularityValues } from "./regularity";

const regularityLabels: Record<Regularity, string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

export function getTitle(goal: { frequency: number; regularity: string }) {
  return `${goal.frequency}x ${regularityLabels[goal.regularity as Regularity]}`;
}

export const goal = sqliteTable(
  "goal",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    habitId: integer("habit_id", { mode: "number" })
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    regularity: text("regularity", { enum: regularityValues }).notNull(),
    frequency: integer("frequency").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("goal_habit_id_idx").on(table.habitId),
    unique("goal_habit_regularity_uniq").on(table.habitId, table.regularity),
  ],
);
