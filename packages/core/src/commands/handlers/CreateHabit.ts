import { habit, goal } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateHabit } from "../schemas";

export async function handleCreateHabit(
  db: AnyDb,
  command: CreateHabit,
): Promise<{ habitId: number }> {
  const [inserted] = await db
    .insert(habit)
    .values({
      title: command.title,
      description: command.description ?? null,
    })
    .returning({ id: habit.id });

  if (command.goal) {
    await db.insert(goal).values({
      habitId: inserted.id,
      regularity: command.goal.regularity,
      frequency: command.goal.frequency,
    });
  }

  return { habitId: inserted.id };
}
