import { useCallback } from "react";
import { useRouter } from "expo-router";
import { Day, habitProgressSnapshot } from "@nag/core";
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
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};

/**
 * For daily habits with `frequency` slots-per-day, classify each day of the
 * current week as done (>= frequency check-ins) or partial (1..frequency-1).
 * `frequency = 1` collapses to "done if any check-in".
 */
const classifyDailyWeek = (
  weekCheckIns: { timestamp: Date }[],
  frequency: number,
): { completedDaysMask: number; partialDaysMask: number } => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of weekCheckIns) {
    counts[c.timestamp.getDay()] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  const target = Math.max(1, frequency);
  const dayBits = [
    Day.Sun,
    Day.Mon,
    Day.Tue,
    Day.Wed,
    Day.Thu,
    Day.Fri,
    Day.Sat,
  ];
  for (let dow = 0; dow < 7; dow++) {
    const n = counts[dow];
    if (n >= target) completedDaysMask |= dayBits[dow];
    else if (n > 0) partialDaysMask |= dayBits[dow];
  }
  return { completedDaysMask, partialDaysMask };
};
