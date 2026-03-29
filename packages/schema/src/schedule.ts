import { sqliteTable, integer, index } from "drizzle-orm/sqlite-core";
import { goal } from "./goal";
import { isoTimestamp } from "./isoTimestamp";

export const schedule = sqliteTable(
  "schedule",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    goalId: integer("goal_id", { mode: "number" })
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    hour: integer("hour").notNull(),
    minute: integer("minute").notNull(),
    days: integer("days"),
    dayOfMonth: integer("day_of_month"),
    createdAt: isoTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("schedule_goal_id_idx").on(table.goalId)],
);
