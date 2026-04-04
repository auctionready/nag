import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import type { GoalPayload } from "../commands/schemas";
import { getNotificationScheduler } from "../notifications";

interface UpdateHabitInput {
  title?: string;
  description?: string | null;
  goal?: GoalPayload | null;
}

export const updateHabit = async (
  db: AnyDb,
  habitId: number,
  input: UpdateHabitInput,
) => {
  await processCommand(db, {
    type: "UpdateHabit",
    habitId,
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
        input.title!,
        notificationSchedules,
        input.goal.regularity,
      );
    } else {
      await getNotificationScheduler().cancelNotifications(habitId);
    }
  } else {
    await getNotificationScheduler().cancelNotifications(habitId);
  }
};
