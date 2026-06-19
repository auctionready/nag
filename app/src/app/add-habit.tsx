import { useRouter } from "expo-router";
import { seqUuid } from "@nag/schema";
import { dispatch } from "../infrastructure/dispatch";
import { HabitForm, type HabitFormData } from "../components/habit-form";
import { buildGoalPayload } from "../operations";
import { useUnsavedChangesPrompt } from "../hooks/useUnsavedChangesPrompt";

const AddHabitScreen = () => {
  const router = useRouter();
  const { setDirty, allowLeave } = useUnsavedChangesPrompt();

  const onSubmit = async (values: HabitFormData) => {
    await dispatch({
      type: "CreateHabit",
      habitId: seqUuid(),
      title: values.title,
      description: values.description || undefined,
      icon: values.icon ?? undefined,
      goal: buildGoalPayload(values) ?? undefined,
    });
    allowLeave();
    router.back();
  };

  const onCancel = () => {
    allowLeave();
    router.back();
  };

  return (
    <HabitForm
      onSubmit={onSubmit}
      onCancel={onCancel}
      onDirtyChange={setDirty}
      mode="create"
    />
  );
};
export default AddHabitScreen;
