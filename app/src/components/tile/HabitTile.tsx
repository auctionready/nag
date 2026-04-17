import { useCallback } from "react";
import { useRouter } from "expo-router";
import { db } from "../../db";
import {
  processCommand,
  isScheduledToday,
  withinDayColor,
  checkInDaysMask,
  classifyScheduledDays,
} from "@nag/core";
import { tileStatus, complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import { computeRingProgress } from "./computeRingProgress";
import type { PeriodIndicatorsProps } from "./PeriodIndicators";

interface HabitTileProps {
  id: number;
  title: string;
}

export const HabitTile = ({ id, title }: HabitTileProps) => {
  const router = useRouter();
  const goal = useHabitGoalSummary(id);
  const { checkInCount, periodCheckIns, recentCheckIns, schedules } =
    useHabitCompliance(id, goal);
  const { color: trafficColor, periodProgress } = tileStatus(
    goal,
    checkInCount,
    schedules,
  );
  const combinedDays = schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);
  const isWeekly = goal?.regularity === "week";
  const hasSchedule = isWeekly && combinedDays !== 0;
  const isOffDay = hasSchedule && !isScheduledToday(schedules);
  // Use the unbounded period query so back-filled check-ins (whose deemed
  // `timestamp` may sort earlier than newer entries) still light up their
  // day. Partial completion (e.g. 2 of 3 slots) is reported separately so
  // the day cell paints orange instead of green.
  const { completedDaysMask: scheduledCompletedMask, partialDaysMask } =
    classifyScheduledDays({ schedules, checkIns: periodCheckIns });
  // Weekly goal with no day-of-week schedule: light up the days the
  // user actually checked in on, in plain green (no today/partial/missed).
  const unscheduledWeeklyMask =
    isWeekly && !hasSchedule ? checkInDaysMask(periodCheckIns) : 0;
  const effectiveScheduledMask = hasSchedule
    ? combinedDays
    : unscheduledWeeklyMask;
  const effectiveCheckedInMask = hasSchedule
    ? scheduledCompletedMask
    : unscheduledWeeklyMask;
  const effectivePartialMask = hasSchedule ? partialDaysMask : 0;

  const now = new Date();
  const isMonthly = goal?.regularity === "month";

  const todayColor =
    hasSchedule && !isOffDay
      ? withinDayColor(
          {
            schedules,
            checkInTimestamps: periodCheckIns.map((c) => c.timestamp),
            now,
          },
          complianceColors,
        )
      : undefined;

  const periodIndicators: PeriodIndicatorsProps | undefined = isMonthly
    ? { regularity: "month", checkIns: periodCheckIns, now }
    : effectiveScheduledMask
      ? {
          regularity: "week",
          scheduledDaysMask: effectiveScheduledMask,
          checkedInDaysMask: effectiveCheckedInMask,
          partialDaysMask: effectivePartialMask,
          todayColor: hasSchedule ? todayColor : undefined,
          partialColor: hasSchedule ? complianceColors.partial : undefined,
          missedColor: hasSchedule ? complianceColors.failing : undefined,
        }
      : undefined;

  const ringProgress = computeRingProgress({
    hasSchedule,
    scheduledDaysMask: combinedDays,
    schedules,
    recentCheckIns: periodCheckIns,
    frequency: goal?.frequency ?? 0,
    periodProgress,
    now,
  });

  const handlePress = useCallback(() => {
    router.push(`/habit/${id}`);
  }, [router, id]);

  const handleCheckIn = useCallback(async () => {
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId: id,
      timestamp: new Date(),
    });
  }, [id]);

  return (
    <HabitTileView
      id={id}
      title={title}
      goal={goal}
      checkInCount={checkInCount}
      recentCheckIns={recentCheckIns}
      color={isOffDay ? "#8E8E93" : trafficColor}
      ringProgress={isOffDay ? 0 : ringProgress}
      isOffDay={isOffDay}
      periodIndicators={periodIndicators}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
