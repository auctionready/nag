import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { db } from "../../../db";
import { habitById, goalForHabitFull, schedulesForGoal } from "@nag/core";
import { dispatch } from "../../../infrastructure/dispatch";
import {
  HabitForm,
  StatusNote,
  type HabitFormData,
} from "../../../components/habit-form";
import { HabitActions } from "../../../components/habit-actions";
import type { HabitIconKind } from "../../../components/glyphs";
import { buildGoalPayload } from "../../../operations";

const EditHabitScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const habitId = id ?? "";

  const { data: habits } = useLiveQuery(habitById(db, habitId), [habitId]);
  const habitData = habits?.[0];
  const archived = habitData?.archivedAt != null;
  const paused = habitData?.pausedAt != null;

  // Archived habits are read-only — they can't be edited. Bounce back to
  // the detail screen (also fires right after archiving from the menu).
  useEffect(() => {
    if (habitData && archived) {
      router.replace(`/habit/${habitId}`);
    }
  }, [habitData, archived, habitId, router]);

  // Header hamburger menu (pause / archive / delete). The smart
  // HabitActions component owns the lifecycle logic.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: habitData
        ? () => <HabitActions habitId={habitId} paused={paused} />
        : undefined,
    });
  }, [navigation, habitData, habitId, paused]);

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

    // If DB regularity is "week" and has schedules, show as "scheduled" in the form
    const isScheduled = goalData?.regularity === "week" && hasSchedules;

    return {
      title: habitData.title,
      description: habitData.description ?? "",
      icon: (habitData.icon ?? null) as HabitIconKind | null,
      regularity: isScheduled ? "scheduled" : (goalData?.regularity ?? "none"),
      frequency: goalData ? String(goalData.frequency) : "1",
      schedules: hasSchedules
        ? scheduleData.map((s) => ({
            hour: String(s.hour),
            minute: String(s.minute).padStart(2, "0"),
            ...(s.days != null ? { days: s.days } : {}),
            reminder: s.reminder !== false,
          }))
        : [{ hour: "9", minute: "00", days: 0, reminder: true }],
    };
  }, [habitData, goalData, schedulesReady, scheduleData]);

  const onSubmit = async (values: HabitFormData) => {
    const goal = buildGoalPayload(values);
    await dispatch({
      type: "UpdateHabit",
      habitId,
      title: values.title,
      description: values.description || null,
      icon: values.icon ?? null,
      goal: goal ?? null,
    });
    router.back();
  };

  // Archived habits redirect to detail (effect above) — don't flash the
  // editable form in the meantime.
  if (!initialValues || archived) {
    return null;
  }

  return (
    <HabitForm
      key={habitId}
      mode="edit"
      initialValues={initialValues}
      onSubmit={onSubmit}
      banner={<StatusNote status={paused ? "paused" : "active"} />}
    />
  );
};

export default EditHabitScreen;
