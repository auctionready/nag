import { processCommand } from "@nag/core";
import { db } from "./db";
import type { HabitFormData } from "./components/HabitForm";
import { syncNotifications, cancelNotifications } from "./notifications";

function buildGoalPayload(values: HabitFormData) {
  if (values.regularity === "none") return undefined;

  if (values.regularity === "scheduled") {
    return {
      regularity: "week" as const,
      schedules: values.schedules.map((s) => ({
        hour: Number(s.hour),
        minute: Number(s.minute),
        days: s.days,
        reminder: s.reminder !== false,
      })),
    };
  }

  return {
    regularity: values.regularity,
    frequency: Number(values.frequency),
  };
}

export async function createHabit(values: HabitFormData) {
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
}

export async function updateHabit(habitId: number, values: HabitFormData) {
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
}

export async function deleteHabit(habitId: number) {
  await cancelNotifications(habitId);
  await processCommand(db, { type: "DeleteHabit", habitId });
}
