import { useCallback } from "react";
import { useRouter } from "expo-router";
import { habitProgressSnapshot } from "@nag/core";
import { dispatch } from "../../infrastructure/dispatch";
import { complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import type { PeriodIndicatorsProps } from "./PeriodIndicators";
import { computeTodaySlots } from "./computeTodaySlots";
import { classifyDailyWeek } from "./classifyDailyWeek";

interface HabitTileProps {
  id: number;
  title: string;
  icon?: string | null;
}

const ALL_DAYS_MASK = 0x7f; // Sun..Sat all set — every day "scheduled" for daily habits.

export const HabitTile = ({ id, title, icon }: HabitTileProps) => {
  const router = useRouter();
  const goal = useHabitGoalSummary(id);
  const {
    checkInCount,
    periodCheckIns,
    weekCheckIns,
    recentCheckIns,
    schedules,
  } = useHabitCompliance(id, goal);

  const now = new Date();
  const snap = habitProgressSnapshot({
    goal,
    schedules,
    periodCheckIns,
    periodCheckInCount: checkInCount,
    now,
    colors: complianceColors,
  });

  const isDaily = goal?.regularity === "day";
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

  // Daily habits show a 7-day strip with every day "scheduled". Each day's
  // cell is "done" once the user hits goal.frequency check-ins, "partial"
  // when they've checked in but haven't yet, and "missed"/"future" when
  // empty — driven by classifyDailyWeek over this week's check-ins.
  const dailyMasks =
    isDaily && goal ? classifyDailyWeek(weekCheckIns, goal.frequency) : null;

  // Today's slot pips — only shown when there's >1 slot in a day. For
  // scheduled habits we map matchCheckInsToSlots' result; for daily-frequency
  // habits with frequency > 1 we synthesise pips from today's check-in count.
  const todaySlots = computeTodaySlots(
    goal,
    snap.slots,
    weekCheckIns,
    schedules.length,
    now,
  );

  const periodIndicators: PeriodIndicatorsProps | undefined = isMonthly
    ? { regularity: "month", checkIns: periodCheckIns, now }
    : dailyMasks
      ? {
          regularity: "day",
          scheduledDaysMask: ALL_DAYS_MASK,
          checkedInDaysMask: dailyMasks.completedDaysMask,
          partialDaysMask: dailyMasks.partialDaysMask,
        }
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
      todaySlots={todaySlots}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
