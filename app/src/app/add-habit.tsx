import { useRouter } from "expo-router";
import { db } from "../db";
import { processCommand } from "@nag/core";
import { HabitForm, type HabitFormData } from "../components/HabitForm";

export default function AddHabitScreen() {
  const router = useRouter();

  const onSubmit = async (data: HabitFormData) => {
    let goal;
    if (data.regularity !== "none") {
      if (data.goalMode === "scheduled") {
        goal = {
          regularity: data.regularity,
          schedules: data.schedules.map((s) => ({
            hour: Number(s.hour),
            minute: Number(s.minute),
            ...(data.regularity === "week"
              ? { dayOfWeek: Number(s.dayOfWeek) }
              : {}),
            ...(data.regularity === "month"
              ? { dayOfMonth: Number(s.dayOfMonth) }
              : {}),
          })),
        };
      } else {
        goal = {
          regularity: data.regularity,
          frequency: Number(data.frequency),
        };
      }
    }

    await processCommand(db, {
      type: "CreateHabit",
      title: data.title,
      description: data.description || undefined,
      goal,
    });
    router.back();
  };

  return <HabitForm onSubmit={onSubmit} />;
}
