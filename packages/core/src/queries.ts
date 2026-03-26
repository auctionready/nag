import { and, count, desc, eq, gte } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { checkIn, goal } from "@nag/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BaseSQLiteDatabase<any, any, any>;

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
