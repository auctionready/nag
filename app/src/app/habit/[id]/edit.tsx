import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { db } from "../../../db";
import { habitStatus } from "@nag/schema";
import { habitById, goalForHabitFull, schedulesForHabit } from "@nag/core";
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
  const status = habitStatus(habitData ?? {});
  const archived = status === "archived";
  const paused = status === "paused";

  // Archived habits are read-only — they can't be edited. Leave the
  // editor (this also fires right after archiving from the menu). Pop back
  // to the detail screen we came from rather than `replace`-ing, which
  // would stack a duplicate detail and break the back button.
  useEffect(() => {
    if (!habitData || !archived) return;
    if (router.canGoBack()) {
      router.back();
    } else {
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

  // Both queries are keyed on the stable `habitId`, so they resolve
  // independently and consistently. Keying the schedule lookup on the
  // goal's integer id instead would race: the goal can load (regularity
  // "week") a render before its schedules do, mounting the form as
  // "weekly" instead of "scheduled" — and react-hook-form's defaultValues
  // only apply on mount, so the wrong pill sticks.
  const { data: goals } = useLiveQuery(goalForHabitFull(db, habitId), [
    habitId,
  ]);
  const goalData = goals?.[0];

  const { data: scheduleData } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);

  // Wait for every query the form reads from — habit, goal, and schedules
  // — before deriving initial values, so we never seed the form from a
  // half-loaded snapshot.
  const ready =
    !!habitData && goals !== undefined && scheduleData !== undefined;

  const initialValues = useMemo<Partial<HabitFormData> | undefined>(() => {
    if (!habitData || !ready) return undefined;
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
  }, [habitData, goalData, ready, scheduleData]);

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
      banner=<StatusNote status={status} />
    />
  );
};

export default EditHabitScreen;
