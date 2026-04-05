import { processCommand } from "../commands/processor";
import type { AnyDb } from "../db";
import type { GoalPayload } from "../commands/schemas";
import { syncAllNotifications } from "../notificationConsolidator";

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

  await syncAllNotifications(db);

  return { habitId };
};
