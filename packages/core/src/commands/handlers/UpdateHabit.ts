import { eq } from "drizzle-orm";
import { habit, goal } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateHabit } from "../schemas";

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
    await db.insert(goal).values({
      habitId: command.habitId,
      regularity: command.goal.regularity,
      frequency: command.goal.frequency,
    });
  }
}
