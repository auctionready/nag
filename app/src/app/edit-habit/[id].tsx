import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useMemo } from "react";
import { db } from "../../db";
import { habitById, goalForHabitFull, schedulesForGoal } from "@nag/core";
import { HabitForm, type HabitFormData } from "../../components/HabitForm";
import { updateHabit, deleteHabit } from "../../saveHabit";

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const habitId = Number(id);

  const { data: habits } = useLiveQuery(habitById(db, habitId), [habitId]);
  const habitData = habits?.[0];

  const { data: goals } = useLiveQuery(goalForHabitFull(db, habitId), [
    habitId,
  ]);
  const goalData = goals?.[0];

  const goalId = goalData?.id ?? -1;
  const { data: scheduleData } = useLiveQuery(schedulesForGoal(db, goalId), [
    goalId,
  ]);

  const schedulesReady = scheduleData !== undefined;

  const initialValues = useMemo<Partial<HabitFormData> | undefined>(() => {
    if (!habitData || !schedulesReady) return undefined;
    const hasSchedules = scheduleData && scheduleData.length > 0;
    return {
      title: habitData.title,
      description: habitData.description ?? "",
      regularity: goalData?.regularity ?? "none",
      frequency: goalData ? String(goalData.frequency) : "1",
      goalMode: hasSchedules ? "scheduled" : "frequency",
      schedules: hasSchedules
        ? scheduleData.map((s) => ({
            hour: String(s.hour),
            minute: String(s.minute).padStart(2, "0"),
            ...(s.dayOfWeek != null ? { dayOfWeek: String(s.dayOfWeek) } : {}),
            ...(s.dayOfMonth != null
              ? { dayOfMonth: String(s.dayOfMonth) }
              : {}),
          }))
        : [{ hour: "9", minute: "00" }],
    };
  }, [habitData, goalData, schedulesReady, scheduleData]);

  const onSubmit = async (values: HabitFormData) => {
    await updateHabit(habitId, values);
    router.back();
  };

  const onDelete = () => {
    Alert.alert(
      "Delete Habit",
      "Are you sure? This will also delete all check-ins and goals for this habit.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteHabit(habitId);
            router.dismissAll();
          },
        },
      ],
    );
  };

  if (!habitData) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <HabitForm
      initialValues={initialValues}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
});
