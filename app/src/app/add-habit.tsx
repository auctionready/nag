import { useRouter } from "expo-router";
import { HabitForm, type HabitFormData } from "../components/HabitForm";
import { createHabit } from "../saveHabit";

export default function AddHabitScreen() {
  const router = useRouter();

  const onSubmit = async (values: HabitFormData) => {
    await createHabit(values);
    router.back();
  };

  return <HabitForm onSubmit={onSubmit} />;
}
