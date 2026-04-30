import { eq } from "drizzle-orm";
import { habit, goal, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { UpdateHabit } from "../schemas";
import type {
  HabitDetailsEdited,
  HabitGoalCleared,
  HabitGoalDefined,
} from "../../events";

function popcount(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

type Event = HabitDetailsEdited | HabitGoalDefined | HabitGoalCleared;

export type UpdateHabitResult = {
  scheduleIds: number[];
  events: Event[];
};

export async function handleUpdateHabit(
  db: AnyDb,
  command: UpdateHabit,
): Promise<UpdateHabitResult> {
  const [existing] = await db
    .select({ externalId: habit.externalId })
    .from(habit)
    .where(eq(habit.id, command.habitId));
  if (!existing) {
    throw new Error(`UpdateHabit: habit id=${command.habitId} not found`);
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (command.title !== undefined) set.title = command.title;
  if (command.description !== undefined) set.description = command.description;

  await db.update(habit).set(set).where(eq(habit.id, command.habitId));

  const events: Event[] = [];

  // Emit a HabitDetailsEdited iff any editorial field is in the command.
  if (command.title !== undefined || command.description !== undefined) {
    const edited: HabitDetailsEdited = {
      type: "HabitDetailsEdited",
      habitId: existing.externalId,
    };
    if (command.title !== undefined) edited.title = command.title;
    if (command.description === null) {
      edited.clearDescription = true;
    } else if (command.description !== undefined) {
      edited.description = command.description;
    }
    events.push(edited);
  }

  let scheduleIds: number[] = [];

  if (command.goal === null) {
    await db.delete(goal).where(eq(goal.habitId, command.habitId));
    const cleared: HabitGoalCleared = {
      type: "HabitGoalCleared",
      habitId: existing.externalId,
    };
    events.push(cleared);
  } else if (command.goal !== undefined) {
    await db.delete(goal).where(eq(goal.habitId, command.habitId));

    const frequency = command.goal.schedules
      ? command.goal.regularity === "week"
        ? command.goal.schedules.reduce(
            (sum, s) => sum + popcount(s.days ?? 0),
            0,
          )
        : command.goal.schedules.length
      : command.goal.frequency!;

    const [insertedGoal] = await db
      .insert(goal)
      .values({
        habitId: command.habitId,
        regularity: command.goal.regularity,
        frequency,
      })
      .returning({ id: goal.id });

    if (command.goal.schedules) {
      const insertedSchedules = await db
        .insert(schedule)
        .values(
          command.goal.schedules.map((s) => ({
            goalId: insertedGoal.id,
            hour: s.hour,
            minute: s.minute,
            days: s.days ?? null,
            dayOfMonth: s.dayOfMonth ?? null,
            reminder: s.reminder ?? true,
          })),
        )
        .returning({ id: schedule.id });
      scheduleIds = insertedSchedules.map((s) => s.id);
    }

    const defined: HabitGoalDefined = {
      type: "HabitGoalDefined",
      habitId: existing.externalId,
      regularity: command.goal.regularity,
      frequency: command.goal.frequency ?? null,
      schedules: command.goal.schedules
        ? command.goal.schedules.map((s) => ({
            hour: s.hour,
            minute: s.minute,
            days: s.days ?? null,
            dayOfMonth: s.dayOfMonth ?? null,
            reminder: s.reminder ?? null,
          }))
        : null,
    };
    events.push(defined);
  }

  return { scheduleIds, events };
}
