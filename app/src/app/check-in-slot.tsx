import { useCallback, useMemo } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import {
  checkInsForHabitsOnDay,
  formatSlotTime,
  formatTimeOfDay,
  habitsByIds,
  matchCheckInsToSlots,
  schedulesForHabits,
  type SlotState,
} from "@nag/core";
import { seqUuid } from "@nag/schema";
import { dispatch } from "../infrastructure/dispatch";
import {
  SlotCheckIn,
  type SlotCheckInItem,
  type SlotCheckInState,
} from "../components/SlotCheckIn";
import type { HabitIconKind } from "../components/HabitGlyph";

const CheckInSlotScreen = () => {
  const {
    habitIds: rawIds,
    h: slotHourRaw,
    m: slotMinuteRaw,
  } = useLocalSearchParams<{ habitIds: string; h?: string; m?: string }>();
  const router = useRouter();
  const habitIds = (rawIds ?? "").split(",").filter((s) => s.length > 0);
  const slotHour = slotHourRaw !== undefined ? Number(slotHourRaw) : undefined;
  const slotMinute =
    slotMinuteRaw !== undefined ? Number(slotMinuteRaw) : undefined;

  // Freeze `now` for the lifetime of the screen so the day-range passed
  // to `useLiveQuery` is stable — otherwise every render would re-prepare
  // the query with a new `Date`.
  const { now, dayStart, dayEnd } = useMemo(() => {
    const now = new Date();
    return {
      now,
      dayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      dayEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    };
  }, []);

  const { data: habits } = useLiveQuery(habitsByIds(db, habitIds), [rawIds]);
  const { data: checkIns } = useLiveQuery(
    checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd),
    [rawIds],
  );
  const { data: schedules } = useLiveQuery(schedulesForHabits(db, habitIds), [
    rawIds,
  ]);

  const handleCheckIn = useCallback(async (habitId: string) => {
    await dispatch({
      type: "CreateCheckIn",
      checkInId: seqUuid(),
      habitId,
      timestamp: new Date(),
    });
  }, []);

  const handleSkip = useCallback(async (habitId: string) => {
    await dispatch({
      type: "CreateCheckIn",
      checkInId: seqUuid(),
      habitId,
      timestamp: new Date(),
      skipped: true,
    });
  }, []);

  const handleDone = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  const items: SlotCheckInItem[] = (habits ?? []).map((h) => {
    const habitSchedules = (schedules ?? []).filter((s) => s.habitId === h.id);
    const habitCheckIns = (checkIns ?? [])
      .filter((c) => c.habitId === h.id)
      .map((c) => ({ timestamp: c.timestamp, skipped: c.skipped }));
    const { slots } = matchCheckInsToSlots({
      schedules: habitSchedules,
      checkIns: habitCheckIns,
      now,
    });
    const slot = pickSlot(slots, slotHour, slotMinute, now);
    const initialState: SlotCheckInState =
      slot?.status === "done"
        ? "done"
        : slot?.status === "skipped"
          ? "skip"
          : "pending";
    return {
      id: h.id,
      title: h.title,
      icon: (h.icon as HabitIconKind | null) ?? null,
      slotMeta: slot ? formatSlotTime(slot.hour, slot.minute) : undefined,
      initialState,
      loggedAt: slot?.matchedAt ? formatTimeOfDay(slot.matchedAt) : undefined,
    };
  });

  const groupTime = formatGroupTime(slotHour, slotMinute, items);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SlotCheckIn
        groupTime={groupTime}
        habits={items}
        onCheckIn={handleCheckIn}
        onSkip={handleSkip}
        onDone={handleDone}
        onClose={handleDone}
      />
    </>
  );
};

const pickSlot = (
  slots: SlotState[],
  slotHour: number | undefined,
  slotMinute: number | undefined,
  now: Date,
): SlotState | undefined => {
  if (slots.length === 0) return undefined;
  if (
    slotHour !== undefined &&
    slotMinute !== undefined &&
    !isNaN(slotHour) &&
    !isNaN(slotMinute)
  ) {
    const exact = slots.find(
      (s) => s.hour === slotHour && s.minute === slotMinute,
    );
    if (exact) return exact;
  }
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return slots.reduce((best, s) => {
    const d = Math.abs(s.hour * 60 + s.minute - nowMins);
    const bd = Math.abs(best.hour * 60 + best.minute - nowMins);
    return d < bd ? s : best;
  });
};

const formatGroupTime = (
  slotHour: number | undefined,
  slotMinute: number | undefined,
  items: SlotCheckInItem[],
): string | undefined => {
  if (
    slotHour !== undefined &&
    slotMinute !== undefined &&
    !isNaN(slotHour) &&
    !isNaN(slotMinute)
  ) {
    return formatSlotTime(slotHour, slotMinute);
  }
  // Fall back to the first row's slot meta if all rows share it.
  const first = items[0]?.slotMeta;
  if (first && items.every((i) => i.slotMeta === first)) return first;
  return undefined;
};

export default CheckInSlotScreen;
