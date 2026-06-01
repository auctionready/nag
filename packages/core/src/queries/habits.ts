import { desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { goal, habit } from "@nag/schema";
import type { AnyDb } from "../db";

export const allHabits = (db: AnyDb) => db.select().from(habit);

/**
 * Habits shown on the main board: everything except archived ones.
 * Archived habits are filtered out here (off-screen) rather than in the
 * board component; paused habits remain (the board demotes them).
 */
export const boardHabits = (db: AnyDb) =>
  db.select().from(habit).where(isNull(habit.archivedAt));

/**
 * Archived habits, for the Accounts → Archived Habits subscreen. Newest
 * archived first.
 */
export const archivedHabits = (db: AnyDb) =>
  db
    .select()
    .from(habit)
    .where(isNotNull(habit.archivedAt))
    .orderBy(desc(habit.archivedAt));

export const habitById = (db: AnyDb, habitId: string) =>
  db.select().from(habit).where(eq(habit.id, habitId));

// All-zeros UUID stands in as a deliberately-unmatchable sentinel when the
// input list is empty — `inArray(... , [])` is a SQL syntax error on SQLite,
// and the `id` column is a 16-byte BLOB so the sentinel must parse as one.
const EMPTY_UUID_SENTINEL = "00000000-0000-0000-0000-000000000000";

export const habitsByIds = (db: AnyDb, habitIds: string[]) =>
  db
    .select({ id: habit.id, title: habit.title, icon: habit.icon })
    .from(habit)
    .where(
      inArray(habit.id, habitIds.length > 0 ? habitIds : [EMPTY_UUID_SENTINEL]),
    );

export const goalForHabit = (db: AnyDb, habitId: string) =>
  db
    .select({
      frequency: goal.frequency,
      regularity: goal.regularity,
      createdAt: goal.createdAt,
    })
    .from(goal)
    .where(eq(goal.habitId, habitId))
    .limit(1);

export const goalForHabitFull = (db: AnyDb, habitId: string) =>
  db.select().from(goal).where(eq(goal.habitId, habitId));

export const goalsForHabits = (db: AnyDb, habitIds: string[]) =>
  db
    .select({
      habitId: goal.habitId,
      frequency: goal.frequency,
      regularity: goal.regularity,
    })
    .from(goal)
    .where(
      inArray(
        goal.habitId,
        habitIds.length > 0 ? habitIds : [EMPTY_UUID_SENTINEL],
      ),
    );
