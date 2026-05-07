import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { DeleteHabit } from "../schemas";
import type { HabitDeleted } from "../../events";

export type DeleteHabitResult = {
  externalId: string;
  events: [HabitDeleted];
};

export type DeleteHabitOutput = {
  events: [HabitDeleted];
  finalize: (applied: unknown[]) => DeleteHabitResult;
};

export const handleDeleteHabit = async (
  db: AnyDb,
  { habitId }: DeleteHabit,
): Promise<DeleteHabitOutput> => {
  const [row] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!row) {
    throw new Error(`DeleteHabit: habit id=${habitId} not found`);
  }
  const { externalId } = row;
  const event: HabitDeleted = { type: "HabitDeleted", habitId: externalId };
  return {
    events: [event],
    finalize: () => ({ externalId, events: [event] }),
  };
};
