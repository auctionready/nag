import { useCallback } from "react";
import { useRouter } from "expo-router";
import { db } from "../../db";
import { habitProgressSnapshot, processCommand } from "@nag/core";
import { complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import type { PeriodIndicatorsProps } from "./PeriodIndicators";

interface HabitTileProps {
  id: number;
  title: string;
}

const OFF_DAY_COLOR = "#8E8E93";

export const HabitTile = ({ id, title }: HabitTileProps) => {
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
  // A weekly habit with no day-of-week schedule still shows day indicators,
  // but painted from the check-in mask rather than the (empty) schedule.
  const hasSchedule = isWeekly && snap.scheduledDaysMask !== 0;

  const effectiveScheduledMask = hasSchedule
    ? snap.scheduledDaysMask
    : snap.unscheduledWeeklyMask;
  const effectiveCheckedInMask = hasSchedule
    ? snap.completedDaysMask
    : snap.unscheduledWeeklyMask;

  const periodIndicators: PeriodIndicatorsProps | undefined = isMonthly
    ? { regularity: "month", checkIns: periodCheckIns, now }
    : effectiveScheduledMask
      ? {
          regularity: "week",
          scheduledDaysMask: effectiveScheduledMask,
          checkedInDaysMask: effectiveCheckedInMask,
          partialDaysMask: hasSchedule ? snap.partialDaysMask : 0,
          todayColor: hasSchedule ? snap.anchorColor : undefined,
          partialColor: hasSchedule ? complianceColors.partial : undefined,
          missedColor: hasSchedule ? complianceColors.failing : undefined,
        }
      : undefined;

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
      color={snap.isAnchorOffDay ? OFF_DAY_COLOR : snap.periodColor}
      ringProgress={snap.isAnchorOffDay ? 0 : snap.ring}
      isOffDay={snap.isAnchorOffDay}
      periodIndicators={periodIndicators}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
