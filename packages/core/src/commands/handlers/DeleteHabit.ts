import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteHabit } from "../schemas";

export async function handleDeleteHabit(
  db: AnyDb,
  command: DeleteHabit,
): Promise<{ externalId: string }> {
  const deleted = await db
    .delete(habit)
    .where(eq(habit.id, command.habitId))
    .returning({ externalId: habit.externalId });

  if (deleted.length === 0) {
    throw new Error(`DeleteHabit: habit id=${command.habitId} not found`);
  }

  return { externalId: deleted[0].externalId };
}
