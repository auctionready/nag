import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteHabit } from "../schemas";

export async function handleDeleteHabit(
  db: AnyDb,
  command: DeleteHabit,
): Promise<void> {
  await db.delete(habit).where(eq(habit.id, command.habitId));
}
