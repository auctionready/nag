import { processCommand } from "@nag/core";
import { db } from "../db";
import type { HabitFormData } from "../components/HabitForm";
import { syncNotifications, cancelNotifications } from "../notifications";
import { buildGoalPayload } from "./buildGoalPayload";

export const updateHabit = async (habitId: number, values: HabitFormData) => {
  const goal = buildGoalPayload(values);
  await processCommand(db, {
    type: "UpdateHabit",
    habitId,
    title: values.title,
    description: values.description || null,
    goal: goal ?? null,
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
    } else {
      await cancelNotifications(habitId);
    }
  } else {
    await cancelNotifications(habitId);
  }
};
