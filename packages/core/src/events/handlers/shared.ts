import { eq } from "drizzle-orm";
import { checkIn, goal, habit, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";

/**
 * Server-shaped goal payload (externalId-keyed). Mirrors the C# `GoalPayload`
 * record; the backend echoes it back unchanged on `/sync` replay.
 */
export type ServerGoal = {
  regularity: "day" | "week" | "month";
  frequency: number | null;
  schedules:
    | {
        hour: number;
        minute: number;
        days: number | null;
        dayOfMonth: number | null;
        reminder: boolean | null;
      }[]
    | null;
};

const popcount = (n: number): number => {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
};

export const computeFrequency = (g: ServerGoal): number => {
  if (g.schedules && g.schedules.length > 0) {
    if (g.regularity === "week") {
      return g.schedules.reduce((sum, s) => sum + popcount(s.days ?? 0), 0);
    }
    return g.schedules.length;
  }
  return g.frequency ?? 1;
};

/**
 * Replaces a habit's goal + schedule rows. Returns the inserted schedule
 * IDs so command-side callers can surface them in their result; server
 * replay ignores the return.
 */
export const writeGoalAndSchedules = async (
  db: AnyDb,
  habitId: number,
  goalPayload: ServerGoal,
): Promise<{ scheduleIds: number[] }> => {
  await db.delete(goal).where(eq(goal.habitId, habitId));
  const [insertedGoal] = await db
    .insert(goal)
    .values({
      habitId,
      regularity: goalPayload.regularity,
      frequency: computeFrequency(goalPayload),
    })
    .returning({ id: goal.id });

  if (!goalPayload.schedules || goalPayload.schedules.length === 0) {
    return { scheduleIds: [] };
  }

  const inserted = await db
    .insert(schedule)
    .values(
      goalPayload.schedules.map((s) => ({
        goalId: insertedGoal.id,
        hour: s.hour,
        minute: s.minute,
        days: s.days,
        dayOfMonth: s.dayOfMonth,
        reminder: s.reminder ?? true,
      })),
    )
    .returning({ id: schedule.id });
  return { scheduleIds: inserted.map((r) => r.id) };
};

export const lookupHabitId = async (
  db: AnyDb,
  externalId: string,
): Promise<number | null> => {
  const [row] = await db
    .select({ id: habit.id })
    .from(habit)
    .where(eq(habit.externalId, externalId));
  return row?.id ?? null;
};

export const lookupCheckInId = async (
  db: AnyDb,
  externalId: string,
): Promise<number | null> => {
  const [row] = await db
    .select({ id: checkIn.id })
    .from(checkIn)
    .where(eq(checkIn.externalId, externalId));
  return row?.id ?? null;
};
