import { habit, goal, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";
import type { CreateHabit } from "../schemas";
import type { HabitCreated } from "../../events";

function popcount(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export type CreateHabitResult = {
  habitId: number;
  externalId: string;
  scheduleIds: number[];
  events: [HabitCreated];
};

export async function handleCreateHabit(
  db: AnyDb,
  command: CreateHabit,
): Promise<CreateHabitResult> {
  const [inserted] = await db
    .insert(habit)
    .values({
      title: command.title,
      description: command.description ?? null,
    })
    .returning({ id: habit.id, externalId: habit.externalId });

  let scheduleIds: number[] = [];

  if (command.goal) {
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
        habitId: inserted.id,
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
  }

  const event: HabitCreated = {
    type: "HabitCreated",
    habitId: inserted.externalId,
    title: command.title,
    description: command.description ?? null,
    icon: null,
    goal: command.goal
      ? {
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
        }
      : null,
  };

  return {
    habitId: inserted.id,
    externalId: inserted.externalId,
    scheduleIds,
    events: [event],
  };
}
