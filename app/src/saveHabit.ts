import { processCommand } from "@nag/core";
import { db } from "./db";
import type { HabitFormData } from "./components/HabitForm";
import { syncNotifications, cancelNotifications } from "./notifications";

function buildGoalPayload(values: HabitFormData) {
  if (values.regularity === "none") return undefined;

  if (values.goalMode === "scheduled") {
    return {
      regularity: values.regularity,
      schedules: values.schedules.map((s) => ({
        hour: Number(s.hour),
        minute: Number(s.minute),
        ...(values.regularity === "week"
          ? { dayOfWeek: Number(s.dayOfWeek) }
          : {}),
        ...(values.regularity === "month"
          ? { dayOfMonth: Number(s.dayOfMonth) }
          : {}),
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
    await syncNotifications(
      habitId,
      values.title,
      goal.schedules,
      goal.regularity,
    );
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
    await syncNotifications(
      habitId,
      values.title,
      goal.schedules,
      goal.regularity,
    );
  } else {
    await cancelNotifications(habitId);
  }
}

export async function deleteHabit(habitId: number) {
  await cancelNotifications(habitId);
  await processCommand(db, { type: "DeleteHabit", habitId });
}
