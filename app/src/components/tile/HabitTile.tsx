import { useCallback } from "react";
import { useRouter } from "expo-router";
import { habitProgressSnapshot } from "@nag/core";
import { dispatch } from "../../infrastructure/dispatch";
import { complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import type { PeriodIndicatorsProps } from "./PeriodIndicators";

interface HabitTileProps {
  id: number;
  title: string;
  icon?: string | null;
}

export const HabitTile = ({ id, title, icon }: HabitTileProps) => {
  const router = useRouter();
  const goal = useHabitGoalSummary(id);
  const { checkInCount, periodCheckIns, recentCheckIns, schedules } =
    useHabitCompliance(id, goal);

  const now = new Date();
  const snap = habitProgressSnapshot({
    goal,
    schedules,
    periodCheckIns,
    periodCheckInCount: checkInCount,
    now,
    colors: complianceColors,
  });

  const isWeekly = goal?.regularity === "week";
  const isMonthly = goal?.regularity === "month";
  const hasSchedule = isWeekly && snap.scheduledDaysMask !== 0;

  const effectiveScheduledMask = hasSchedule
    ? snap.scheduledDaysMask
    : snap.unscheduledWeeklyMask;
  const effectiveCheckedInMask = hasSchedule
    ? snap.completedDaysMask
    : snap.unscheduledWeeklyMask;
  const effectiveAnyCheckInMask = hasSchedule ? snap.anyCheckInDaysMask : 0;

  const periodIndicators: PeriodIndicatorsProps | undefined = isMonthly
    ? { regularity: "month", checkIns: periodCheckIns, now }
    : effectiveScheduledMask
      ? {
          regularity: "week",
          scheduledDaysMask: effectiveScheduledMask,
          checkedInDaysMask: effectiveCheckedInMask,
          partialDaysMask: hasSchedule ? snap.partialDaysMask : 0,
          anyCheckInDaysMask: effectiveAnyCheckInMask,
        }
      : undefined;

  const handlePress = useCallback(() => {
    router.push(`/habit/${id}`);
  }, [router, id]);

  const handleCheckIn = useCallback(async () => {
    await dispatch({
      type: "CreateCheckIn",
      habitId: id,
      timestamp: new Date(),
    });
  }, [id]);

  return (
    <HabitTileView
      id={id}
      title={title}
      icon={icon}
      goal={goal}
      checkInCount={checkInCount}
      recentCheckIns={recentCheckIns}
      scheduleCount={schedules.length}
      isOffDay={snap.isAnchorOffDay}
      periodIndicators={periodIndicators}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
