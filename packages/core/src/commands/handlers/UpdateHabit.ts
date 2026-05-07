import { eq } from "drizzle-orm";
import { habit } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateHabit } from "../schemas";
import type {
  HabitDetailsEdited,
  HabitGoalCleared,
  HabitGoalDefined,
} from "../../events";
import type { HabitGoalDefinedResult } from "../../events/handlers/HabitGoalDefined";

type UpdateHabitEvent =
  | HabitDetailsEdited
  | HabitGoalDefined
  | HabitGoalCleared;

export type UpdateHabitResult = {
  scheduleIds: number[];
  events: UpdateHabitEvent[];
};

export type UpdateHabitOutput = {
  events: UpdateHabitEvent[];
  finalize: (applied: unknown[]) => UpdateHabitResult;
};

/**
 * Validates the habit exists, then emits the appropriate combination of
 * `HabitDetailsEdited` (editorial fields), `HabitGoalCleared`
 * (`goal: null`), and `HabitGoalDefined` (`goal: {...}`) events. The
 * event handlers do the DB writes; the processor wires `applied[]` into
 * `finalize` so we can surface the inserted schedule ids back to the
 * caller (the only piece of DB feedback we still need).
 */
export const handleUpdateHabit = async (
  db: AnyDb,
  { habitId, title, description, icon, goal }: UpdateHabit,
): Promise<UpdateHabitOutput> => {
  const [existing] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, habitId));
  if (!existing) {
    throw new Error(`UpdateHabit: habit id=${habitId} not found`);
  }

  const events: UpdateHabitEvent[] = [];

  // Emit a HabitDetailsEdited iff any editorial field is in the command.
  if (title !== undefined || description !== undefined || icon !== undefined) {
    const edited: HabitDetailsEdited = {
      type: "HabitDetailsEdited",
      habitId: existing.externalId,
    };
    if (title !== undefined) edited.title = title;
    if (description === null) {
      edited.clearDescription = true;
    } else if (description !== undefined) {
      edited.description = description;
    }
    if (icon === null) {
      edited.clearIcon = true;
    } else if (icon !== undefined) {
      edited.icon = icon;
    }
    events.push(edited);
  }

  let goalDefinedIndex: number | undefined;

  if (goal === null) {
    events.push({ type: "HabitGoalCleared", habitId: existing.externalId });
  } else if (goal !== undefined) {
    goalDefinedIndex = events.length;
    events.push({
      type: "HabitGoalDefined",
      habitId: existing.externalId,
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
    });
  }

  return {
    events,
    finalize: (applied) => {
      const scheduleIds =
        goalDefinedIndex !== undefined
          ? (applied[goalDefinedIndex] as HabitGoalDefinedResult).scheduleIds
          : [];
      return { scheduleIds, events };
    },
  };
};
