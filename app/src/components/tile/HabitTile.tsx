import { useCallback } from "react";
import { useRouter } from "expo-router";
import { db } from "../../db";
import { processCommand, isScheduledToday } from "@nag/core";
import { tileStatus } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";

interface HabitTileProps {
  id: number;
  title: string;
}

export const HabitTile = ({ id, title }: HabitTileProps) => {
  const router = useRouter();
  const goal = useHabitGoalSummary(id);
  const { checkInCount, recentCheckIns, schedules } = useHabitCompliance(
    id,
    goal,
  );
  const { color: trafficColor, periodProgress } = tileStatus(
    goal,
    checkInCount,
    schedules,
  );
  const isOffDay = goal?.regularity === "week" && !isScheduledToday(schedules);
  const combinedDays = schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);

  const handlePress = useCallback(() => {
    router.push(`/habit/${id}`);
  }, [router, id]);

  const handleCheckIn = useCallback(async () => {
    await processCommand(db, { type: "CreateCheckIn", habitId: id });
  }, [id]);

  return (
    <HabitTileView
      id={id}
      title={title}
      goal={goal}
      checkInCount={checkInCount}
      recentCheckIns={recentCheckIns}
      color={isOffDay ? "#8E8E93" : trafficColor}
      periodProgress={isOffDay ? 0 : periodProgress}
      isOffDay={isOffDay}
      scheduledDayColor={trafficColor}
      scheduledDaysMask={combinedDays}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};
