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
      goal: buildGoalPayload(values) ?? undefined,
    });
    router.back();
  };

  return <HabitForm onSubmit={onSubmit} />;
};
export default AddHabitScreen;
