import { and, count, desc, eq, gte } from "drizzle-orm";
import { checkIn, goal, habit, schedule } from "@nag/schema";
import type { AnyDb } from "./db";

export function allHabits(db: AnyDb) {
  return db.select().from(habit);
}

export function habitById(db: AnyDb, habitId: number) {
  return db.select().from(habit).where(eq(habit.id, habitId));
}

export function goalForHabitFull(db: AnyDb, habitId: number) {
  return db.select().from(goal).where(eq(goal.habitId, habitId));
}

export function checkInsForHabit(db: AnyDb, habitId: number) {
  return db
    .select()
    .from(checkIn)
    .where(eq(checkIn.habitId, habitId))
    .orderBy(desc(checkIn.timestamp));
}

export function calendarCheckIns(db: AnyDb) {
  return db
    .select({
      id: checkIn.id,
      timestamp: checkIn.timestamp,
      skipped: checkIn.skipped,
      habitId: checkIn.habitId,
      habitTitle: habit.title,
    })
    .from(checkIn)
    .innerJoin(habit, eq(checkIn.habitId, habit.id))
    .orderBy(desc(checkIn.timestamp));
}

export function goalForHabit(db: AnyDb, habitId: number) {
  return db
    .select({
      frequency: goal.frequency,
      regularity: goal.regularity,
      createdAt: goal.createdAt,
    })
    .from(goal)
    .where(eq(goal.habitId, habitId))
    .limit(1);
}

export function checkInCount(db: AnyDb, habitId: number, since?: Date) {
  return db
    .select({ value: count() })
    .from(checkIn)
    .where(
      since
        ? and(eq(checkIn.habitId, habitId), gte(checkIn.timestamp, since))
        : eq(checkIn.habitId, habitId),
    );
}

export function recentCheckIns(
  db: AnyDb,
  habitId: number,
  since?: Date,
  limit = 3,
) {
  return db
    .select({ timestamp: checkIn.timestamp })
    .from(checkIn)
    .where(
      since
        ? and(eq(checkIn.habitId, habitId), gte(checkIn.timestamp, since))
        : eq(checkIn.habitId, habitId),
    )
    .orderBy(desc(checkIn.timestamp))
    .limit(limit);
}

export function schedulesForGoal(db: AnyDb, goalId: number) {
  return db
    .select({
      id: schedule.id,
      hour: schedule.hour,
      minute: schedule.minute,
      days: schedule.days,
      dayOfMonth: schedule.dayOfMonth,
    })
    .from(schedule)
    .where(eq(schedule.goalId, goalId));
}
