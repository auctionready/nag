import { useRouter } from "expo-router";
import { createHabit } from "@nag/core";
import { db } from "../db";
import { HabitForm, type HabitFormData } from "../components/HabitForm";
import { buildGoalPayload } from "../operations";

const AddHabitScreen = () => {
  const router = useRouter();

  const onSubmit = async (values: HabitFormData) => {
    await createHabit(db, {
      title: values.title,
      description: values.description || undefined,
      goal: buildGoalPayload(values) ?? undefined,
    });
    router.back();
  };

  return <HabitForm onSubmit={onSubmit} />;
};
export default AddHabitScreen;
