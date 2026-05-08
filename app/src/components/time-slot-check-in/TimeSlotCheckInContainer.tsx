import { useCallback, useMemo } from "react";
import { Stack } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  checkInsForHabitsOnDay,
  formatTimeSlotTime,
  formatTimeOfDay,
  habitsByIds,
  matchCheckInsToTimeSlots,
  schedulesForHabits,
} from "@nag/core";
import { seqUuid } from "@nag/schema";
import { db } from "../../db";
import { dispatch } from "../../infrastructure/dispatch";
import type { HabitIconKind } from "../../components/glyphs";
import {
  TimeSlotCheckIn,
  type TimeSlotCheckInItem,
  type TimeSlotCheckInState,
} from "./TimeSlotCheckIn";
import { formatGroupTime } from "./formatGroupTime";
import { pickTimeSlot } from "./pickTimeSlot";

export interface TimeSlotCheckInContainerProps {
  habitIds: string[];
  timeSlotHour?: number;
  timeSlotMinute?: number;
  onDone: () => void;
}

export const TimeSlotCheckInContainer = ({
  habitIds,
  timeSlotHour,
  timeSlotMinute,
  onDone,
}: TimeSlotCheckInContainerProps) => {
  const habitIdsKey = habitIds.join(",");

  // Freeze `now` for the lifetime of the screen so the day-range passed
  // to `useLiveQuery` is stable — otherwise every render would re-prepare
  // the query with a new `Date`.
  const { now, dayStart, dayEnd } = useMemo(() => {
    const n = new Date();
    return {
      now: n,
      dayStart: new Date(n.getFullYear(), n.getMonth(), n.getDate()),
      dayEnd: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1),
    };
  }, []);

  const { data: habits } = useLiveQuery(habitsByIds(db, habitIds), [
    habitIdsKey,
  ]);
  const { data: checkIns } = useLiveQuery(
    checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd),
    [habitIdsKey],
  );
  const { data: schedules } = useLiveQuery(schedulesForHabits(db, habitIds), [
    habitIdsKey,
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

  const items: TimeSlotCheckInItem[] = (habits ?? []).map((h) => {
    const habitSchedules = (schedules ?? []).filter((s) => s.habitId === h.id);
    const habitCheckIns = (checkIns ?? [])
      .filter((c) => c.habitId === h.id)
      .map((c) => ({ timestamp: c.timestamp, skipped: c.skipped }));
    const { timeSlots } = matchCheckInsToTimeSlots({
      schedules: habitSchedules,
      checkIns: habitCheckIns,
      now,
    });
    const timeSlot = pickTimeSlot(timeSlots, timeSlotHour, timeSlotMinute, now);
    const initialState: TimeSlotCheckInState =
      timeSlot?.status === "done"
        ? "done"
        : timeSlot?.status === "skipped"
          ? "skip"
          : "pending";
    return {
      id: h.id,
      title: h.title,
      icon: (h.icon as HabitIconKind | null) ?? null,
      timeSlotMeta: timeSlot
        ? formatTimeSlotTime(timeSlot.hour, timeSlot.minute)
        : undefined,
      initialState,
      loggedAt: timeSlot?.matchedAt
        ? formatTimeOfDay(timeSlot.matchedAt)
        : undefined,
    };
  });

  const groupTime = formatGroupTime(timeSlotHour, timeSlotMinute, items);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TimeSlotCheckIn
        groupTime={groupTime}
        habits={items}
        onCheckIn={handleCheckIn}
        onSkip={handleSkip}
        onDone={onDone}
        onClose={onDone}
      />
    </>
  );
};
