import { sqliteTable, integer, index } from "drizzle-orm/sqlite-core";
import { habit } from "./habit";
import { isoTimestamp } from "./isoTimestamp";

export const checkIn = sqliteTable(
  "check_in",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    habitId: integer("habit_id", { mode: "number" })
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    /**
     * The **deemed** slot time for this check-in — i.e. which scheduled slot
     * it's credited to. Caller-supplied via the `CreateCheckIn` command. When
     * the user back-fills a missed 8 a.m. slot at 10 a.m., `timestamp` is
     * 8 a.m. (the slot); `createdAt` is 10 a.m. (the wall-clock recording
     * time). The default only fires if no value is given.
     */
    timestamp: isoTimestamp("timestamp")
      .notNull()
      .$defaultFn(() => new Date()),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    /**
     * Wall-clock time the row was inserted. Always set by the system, never
     * overridable by callers. Compare against `timestamp` to see whether a
     * check-in was back-filled.
     */
    createdAt: isoTimestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: isoTimestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("check_in_habit_id_idx").on(table.habitId),
    index("check_in_timestamp_idx").on(table.timestamp),
  ],
);
