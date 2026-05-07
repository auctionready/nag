import { eq, inArray } from "drizzle-orm";
import { goal, habit, schedule } from "@nag/schema";
import type { AnyDb } from "../db";

export const allActiveSchedules = (db: AnyDb) =>
  db
    .select({
      habitId: habit.id,
      habitTitle: habit.title,
      regularity: goal.regularity,
      scheduleId: schedule.id,
      hour: schedule.hour,
      minute: schedule.minute,
      days: schedule.days,
      dayOfMonth: schedule.dayOfMonth,
    })
    .from(schedule)
    .innerJoin(goal, eq(schedule.goalId, goal.id))
    .innerJoin(habit, eq(goal.habitId, habit.id))
    .where(eq(schedule.reminder, true));

export const schedulesForHabits = (db: AnyDb, habitIds: string[]) =>
  db
    .select({
      habitId: goal.habitId,
      hour: schedule.hour,
      minute: schedule.minute,
      days: schedule.days,
      dayOfMonth: schedule.dayOfMonth,
    })
    .from(schedule)
    .innerJoin(goal, eq(schedule.goalId, goal.id))
    .where(
      inArray(
        goal.habitId,
        habitIds.length > 0
          ? habitIds
          : ["00000000-0000-0000-0000-000000000000"],
      ),
    );

export const schedulesForHabit = (db: AnyDb, habitId: string) =>
  db
    .select({
      days: schedule.days,
      dayOfMonth: schedule.dayOfMonth,
      hour: schedule.hour,
      minute: schedule.minute,
    })
    .from(schedule)
    .innerJoin(goal, eq(schedule.goalId, goal.id))
    .where(eq(goal.habitId, habitId));

export const schedulesForGoal = (db: AnyDb, goalId: number) =>
  db
    .select({
      id: schedule.id,
      hour: schedule.hour,
      minute: schedule.minute,
      days: schedule.days,
      dayOfMonth: schedule.dayOfMonth,
      reminder: schedule.reminder,
    })
    .from(schedule)
    .where(eq(schedule.goalId, goalId));
