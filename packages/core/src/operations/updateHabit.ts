import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import type { GoalPayload } from "../commands/schemas";
import { syncAllNotifications } from "../notificationConsolidator";

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

  await syncAllNotifications(db);
};
