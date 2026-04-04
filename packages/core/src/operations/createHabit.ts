import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import type { GoalPayload } from "../commands/schemas";
import { getNotificationScheduler } from "../notifications";

interface CreateHabitInput {
  title: string;
  description?: string;
  goal?: GoalPayload;
}

export const createHabit = async (db: AnyDb, input: CreateHabitInput) => {
  const { habitId } = await processCommand(db, {
    type: "CreateHabit",
    title: input.title,
    description: input.description,
    goal: input.goal,
  });

  if (input.goal?.schedules) {
    const notificationSchedules = input.goal.schedules.filter(
      (s) => s.reminder !== false,
    );
    if (notificationSchedules.length > 0) {
      await getNotificationScheduler().syncNotifications(
        habitId,
        input.title,
        notificationSchedules,
        input.goal.regularity,
      );
    }
  }

  return { habitId };
};
