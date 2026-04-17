import { habit, goal, schedule } from "@nag/schema";
import type { AnyDb } from "../../db";
import { syncAllNotifications } from "../../notificationConsolidator";
import type { CreateHabit } from "../schemas";

function popcount(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export async function handleCreateHabit(
  db: AnyDb,
  command: CreateHabit,
): Promise<{ habitId: number; scheduleIds: number[] }> {
  const [inserted] = await db
    .insert(habit)
    .values({
      title: command.title,
      description: command.description ?? null,
    })
    .returning({ id: habit.id });

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
      await syncAllNotifications(db);
      return {
        habitId: inserted.id,
        scheduleIds: insertedSchedules.map((s) => s.id),
      };
    }
  }

  await syncAllNotifications(db);
  return { habitId: inserted.id, scheduleIds: [] };
}
