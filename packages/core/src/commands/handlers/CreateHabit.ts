import type { AnyDb } from "../../db";
import type { CreateHabit } from "../schemas";
import type { HabitCreated } from "../../events";
import type { HabitCreatedResult } from "../../events/handlers/HabitCreated";

export type CreateHabitResult = {
  habitId: number;
  externalId: string;
  scheduleIds: number[];
  events: [HabitCreated];
};

export type CreateHabitOutput = {
  events: [HabitCreated];
  finalize: (applied: unknown[]) => CreateHabitResult;
};

/**
 * Pure command handler — produces a `HabitCreated` event with a fresh
 * external UUID. The event handler does the actual habit/goal/schedule
 * inserts when the processor dispatches it; we don't touch the DB here
 * apart from what `finalize` reads back through the apply result.
 */
export const handleCreateHabit = async (
  _db: AnyDb,
  { title, description, icon, goal }: CreateHabit,
): Promise<CreateHabitOutput> => {
  const externalId = crypto.randomUUID();
  const event: HabitCreated = {
    type: "HabitCreated",
    habitId: externalId,
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

  return {
    events: [event],
    finalize: (applied) => {
      const r = applied[0] as HabitCreatedResult;
      if (r.habitId == null) {
        throw new Error(
          "CreateHabit: HabitCreated apply did not return habitId",
        );
      }
      return {
        habitId: r.habitId,
        externalId,
        scheduleIds: r.scheduleIds,
        events: [event],
      };
    },
  };
};
