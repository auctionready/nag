import { eq, inArray } from "drizzle-orm";
import { goal, habit } from "@nag/schema";
import type { AnyDb } from "../db";

export const allHabits = (db: AnyDb) => db.select().from(habit);

export const habitById = (db: AnyDb, habitId: number) =>
  db.select().from(habit).where(eq(habit.id, habitId));

export const habitsByIds = (db: AnyDb, habitIds: number[]) =>
  db
    .select({ id: habit.id, title: habit.title, icon: habit.icon })
    .from(habit)
    .where(inArray(habit.id, habitIds.length > 0 ? habitIds : [-1]));

export const goalForHabit = (db: AnyDb, habitId: number) =>
  db
    .select({
      frequency: goal.frequency,
      regularity: goal.regularity,
      createdAt: goal.createdAt,
    })
    .from(goal)
    .where(eq(goal.habitId, habitId))
    .limit(1);

export const goalForHabitFull = (db: AnyDb, habitId: number) =>
  db.select().from(goal).where(eq(goal.habitId, habitId));
