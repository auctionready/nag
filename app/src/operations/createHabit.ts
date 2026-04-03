import { processCommand } from "@nag/core";
import { db } from "../db";
import type { HabitFormData } from "../components/HabitForm";
import { syncNotifications } from "../notifications";
import { buildGoalPayload } from "./buildGoalPayload";

export const createHabit = async (values: HabitFormData) => {
  const goal = buildGoalPayload(values);
  const { habitId } = await processCommand(db, {
    type: "CreateHabit",
    title: values.title,
    description: values.description || undefined,
    goal,
  });

  if (goal?.schedules) {
    const notificationSchedules = goal.schedules.filter(
      (s) => s.reminder !== false,
    );
    if (notificationSchedules.length > 0) {
      await syncNotifications(
        habitId,
        values.title,
        notificationSchedules,
        goal.regularity,
      );
    }
  }

  return { habitId };
};
