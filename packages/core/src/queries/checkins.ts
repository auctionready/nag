import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { checkIn, habit } from "@nag/schema";
import type { AnyDb } from "../db";

export const checkInsForHabit = (db: AnyDb, habitId: string) =>
  db
    .select()
    .from(checkIn)
    .where(eq(checkIn.habitId, habitId))
    .orderBy(desc(checkIn.timestamp));

export const calendarCheckIns = (db: AnyDb) =>
  db
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

export const checkInCount = (db: AnyDb, habitId: string, since?: Date) =>
  db
    .select({ value: count() })
    .from(checkIn)
    .where(
      since
        ? and(eq(checkIn.habitId, habitId), gte(checkIn.timestamp, since))
        : eq(checkIn.habitId, habitId),
    );

export const recentCheckIns = (
  db: AnyDb,
  habitId: string,
  since?: Date,
  limit = 3,
) =>
  db
    .select({ timestamp: checkIn.timestamp })
    .from(checkIn)
    .where(
      since
        ? and(eq(checkIn.habitId, habitId), gte(checkIn.timestamp, since))
        : eq(checkIn.habitId, habitId),
    )
    .orderBy(desc(checkIn.timestamp))
    .limit(limit);

/**
 * All check-ins for a habit since a given date — no limit. Use this
 * (rather than `recentCheckIns`) when callers need every check-in in
 * the period: day-of-week mask, within-day color, ring progress, etc.
 * `recentCheckIns`'s LIMIT silently drops back-filled check-ins whose
 * `timestamp` (the deemed time-slot time) is earlier than N newer entries
 * in the same period — making the home-board tile's day cells
 * disagree with the habit-detail screen.
 */
export const checkInsInPeriod = (db: AnyDb, habitId: string, since: Date) =>
  db
    .select({ timestamp: checkIn.timestamp })
    .from(checkIn)
    .where(and(eq(checkIn.habitId, habitId), gte(checkIn.timestamp, since)))
    .orderBy(desc(checkIn.timestamp));

/**
 * All check-ins for a set of habits whose deemed `timestamp` falls in
 * `[dayStart, dayEnd)`. Returned chronologically — the order
 * `matchCheckInsToTime-slots` expects.
 */
export const checkInsForHabitsOnDay = (
  db: AnyDb,
  habitIds: string[],
  dayStart: Date,
  dayEnd: Date,
) =>
  db
    .select({
      habitId: checkIn.habitId,
      timestamp: checkIn.timestamp,
      skipped: checkIn.skipped,
    })
    .from(checkIn)
    .where(
      and(
        inArray(
          checkIn.habitId,
          habitIds.length > 0
            ? habitIds
            : ["00000000-0000-0000-0000-000000000000"],
        ),
        gte(checkIn.timestamp, dayStart),
        lt(checkIn.timestamp, dayEnd),
      ),
    )
    .orderBy(asc(checkIn.timestamp));
