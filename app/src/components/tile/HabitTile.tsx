import { useCallback } from "react";
import { useRouter } from "expo-router";
import { db } from "../../db";
import {
  processCommand,
  isScheduledToday,
  withinDayColor,
  classifyScheduledDays,
} from "@nag/core";
import { tileStatus, complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import { computeRingProgress } from "./computeRingProgress";

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
  const hasSchedule = goal?.regularity === "week" && combinedDays !== 0;
  const isOffDay = hasSchedule && !isScheduledToday(schedules);
  // Use the unbounded period query so back-filled check-ins (whose deemed
  // `timestamp` may sort earlier than newer entries) still light up their
  // day. Partial completion (e.g. 2 of 3 slots) is reported separately so
  // the day cell paints orange instead of green.
  const { completedDaysMask: checkedInDaysMask, partialDaysMask } =
    classifyScheduledDays({ schedules, checkIns: periodCheckIns });

  const now = new Date();

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
      hasSchedule={hasSchedule}
      scheduledDaysMask={combinedDays}
      checkedInDaysMask={checkedInDaysMask}
      partialDaysMask={partialDaysMask}
      todayColor={todayColor}
      partialColor={complianceColors.partial}
      missedColor={complianceColors.failing}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
