import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteHabit } from "../schemas";
import type { HabitDeleted } from "../../events";

export type DeleteHabitResult = {
  externalId: string;
  events: [HabitDeleted];
};

export async function handleDeleteHabit(
  db: AnyDb,
  command: DeleteHabit,
): Promise<DeleteHabitResult> {
  const deleted = await db
    .delete(habit)
    .where(eq(habit.id, command.habitId))
    .returning({ externalId: habit.externalId });

  if (deleted.length === 0) {
    throw new Error(`DeleteHabit: habit id=${command.habitId} not found`);
  }

  return {
    externalId: deleted[0].externalId,
    events: [{ type: "HabitDeleted", habitId: deleted[0].externalId }],
  };
}
