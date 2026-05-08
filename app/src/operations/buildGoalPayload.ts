import type { HabitFormData } from "../components/habit-form";

export const buildGoalPayload = (values: HabitFormData) => {
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
};
