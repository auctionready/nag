import { eq } from "drizzle-orm";
import { goal, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";

/**
 * Server-shaped goal payload (UUID-keyed). Mirrors the C# `GoalPayload`
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
 * Replaces a habit's goal + schedule rows. Goal/schedule remain weak
 * entities (integer PKs minted by the DB), so callers don't see the new
 * ids — replays simply delete and reinsert.
 */
export const writeGoalAndSchedules = async (
  db: AnyDb,
  habitId: string,
  goalPayload: ServerGoal,
): Promise<void> => {
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
    return;
  }

  await db.insert(schedule).values(
    goalPayload.schedules.map((s) => ({
      goalId: insertedGoal.id,
      hour: s.hour,
      minute: s.minute,
      days: s.days,
      dayOfMonth: s.dayOfMonth,
      reminder: s.reminder ?? true,
    })),
  );
};
