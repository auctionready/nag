import { eq } from "drizzle-orm";
import { habit, goal, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateHabit } from "../schemas";

function popcount(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export async function handleUpdateHabit(
  db: AnyDb,
  command: UpdateHabit,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (command.title !== undefined) set.title = command.title;
  if (command.description !== undefined) set.description = command.description;

  await db.update(habit).set(set).where(eq(habit.id, command.habitId));

  if (command.goal === null) {
    await db.delete(goal).where(eq(goal.habitId, command.habitId));
  } else if (command.goal !== undefined) {
    await db.delete(goal).where(eq(goal.habitId, command.habitId));

    const frequency = command.goal.schedules
      ? command.goal.regularity === "week"
        ? command.goal.schedules.reduce(
            (sum, s) => sum + popcount(s.days ?? 0),
            0,
          )
        : command.goal.schedules.length
      : command.goal.frequency!;

    const [insertedGoal] = await db
      .insert(goal)
      .values({
        habitId: command.habitId,
        regularity: command.goal.regularity,
        frequency,
      })
      .returning({ id: goal.id });

    if (command.goal.schedules) {
      await db.insert(schedule).values(
        command.goal.schedules.map((s) => ({
          goalId: insertedGoal.id,
          hour: s.hour,
          minute: s.minute,
          days: s.days ?? null,
          dayOfMonth: s.dayOfMonth ?? null,
        })),
      );
    }
  }
}
