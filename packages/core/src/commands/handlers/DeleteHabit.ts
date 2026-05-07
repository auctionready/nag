import type { AnyDb } from "../../db";
import type { DeleteHabit } from "../schemas";
import type { HabitDeleted } from "../../events";

export const handleDeleteHabit = async (
  _db: AnyDb,
  { habitId }: DeleteHabit,
): Promise<{ events: [HabitDeleted] }> => {
  const event: HabitDeleted = { type: "HabitDeleted", habitId };
  return { events: [event] };
};
