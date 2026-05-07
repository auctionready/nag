import type { AnyDb } from "../../db";
import type { CreateHabit } from "../schemas";
import type { HabitCreated } from "../../events";

/**
 * Pure command handler — translates `CreateHabit` into a single
 * `HabitCreated` event using the caller-supplied `habitId`. No DB reads
 * or writes; the processor applies the event through the shared event
 * registry.
 */
export const handleCreateHabit = async (
  _db: AnyDb,
  { habitId, title, description, icon, goal }: CreateHabit,
): Promise<{ events: [HabitCreated] }> => {
  const event: HabitCreated = {
    type: "HabitCreated",
    habitId,
    title,
    description: description ?? null,
    icon: icon ?? null,
    goal: goal
      ? {
          regularity: goal.regularity,
          frequency: goal.frequency ?? null,
          schedules: goal.schedules
            ? goal.schedules.map((s) => ({
                hour: s.hour,
                minute: s.minute,
                days: s.days ?? null,
                dayOfMonth: s.dayOfMonth ?? null,
                reminder: s.reminder ?? null,
              }))
            : null,
        }
      : null,
  };
  return { events: [event] };
};
