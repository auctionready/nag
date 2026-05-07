import type { AnyDb } from "../../db";
import type { UpdateHabit } from "../schemas";
import type {
  HabitDetailsEdited,
  HabitGoalCleared,
  HabitGoalDefined,
} from "../../events";

type UpdateHabitEvent =
  | HabitDetailsEdited
  | HabitGoalDefined
  | HabitGoalCleared;

/**
 * Translates `UpdateHabit` into the appropriate combination of
 * `HabitDetailsEdited` (editorial fields), `HabitGoalCleared`
 * (`goal: null`), and `HabitGoalDefined` (`goal: {...}`) events. The
 * habit's existence is enforced by the event handlers' upsert
 * semantics — a stray UpdateHabit against a missing id is a no-op
 * locally and gets caught server-side.
 */
export const handleUpdateHabit = async (
  _db: AnyDb,
  { habitId, title, description, icon, goal }: UpdateHabit,
): Promise<{ events: UpdateHabitEvent[] }> => {
  const events: UpdateHabitEvent[] = [];

  // Emit a HabitDetailsEdited iff any editorial field is in the command.
  if (title !== undefined || description !== undefined || icon !== undefined) {
    const edited: HabitDetailsEdited = {
      type: "HabitDetailsEdited",
      habitId,
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

  if (goal === null) {
    events.push({ type: "HabitGoalCleared", habitId });
  } else if (goal !== undefined) {
    events.push({
      type: "HabitGoalDefined",
      habitId,
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

  return { events };
};
