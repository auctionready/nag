import {
  sqliteTable,
  integer,
  text,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { habit } from "./habit";
import { uuid, timestamp } from "../columns";
import { type Regularity, regularityValues } from "../regularity";

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
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    regularity: text("regularity", { enum: regularityValues }).notNull(),
    frequency: integer("frequency").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("goal_habit_id_idx").on(table.habitId),
    unique("goal_habit_regularity_uniq").on(table.habitId, table.regularity),
  ],
);
