import { useRouter } from "expo-router";
import { dispatch } from "../infrastructure/dispatch";
import { HabitForm, type HabitFormData } from "../components/HabitForm";
import { buildGoalPayload } from "../operations";

const AddHabitScreen = () => {
  const router = useRouter();

  const onSubmit = async (values: HabitFormData) => {
    await dispatch({
      type: "CreateHabit",
      title: values.title,
      description: values.description || undefined,
      icon: values.icon ?? undefined,
      goal: buildGoalPayload(values) ?? undefined,
    });
    router.back();
  };

  return <HabitForm onSubmit={onSubmit} mode="create" />;
};
export default AddHabitScreen;
