import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../../db";
import { getTitle } from "@nag/schema";
import {
  habitById,
  goalForHabitFull,
  checkInsForHabit,
  checkInCount,
  processCommand,
  periodStart,
  schedulesForHabit,
  tileColor,
} from "@nag/core";
import { HabitDetail } from "../../components/HabitDetail";
import { complianceColors } from "../../components/getComplianceColor";

const HabitScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const habitId = Number(id);

  const { data: habits } = useLiveQuery(habitById(db, habitId), [habitId]);
  const habitData = habits?.[0];

  const { data: goals } = useLiveQuery(goalForHabitFull(db, habitId), [
    habitId,
  ]);
  const goalData = goals?.[0];

  const { data: checkIns } = useLiveQuery(checkInsForHabit(db, habitId), [
    habitId,
  ]);

  const { data: scheduleRows } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);
  const schedules = scheduleRows ?? [];

  const periodStartDate = goalData
    ? periodStart(goalData.regularity)
    : undefined;
  const { data: countRows } = useLiveQuery(
    checkInCount(db, habitId, periodStartDate),
    [habitId, periodStartDate],
  );
  const currentCount = countRows?.[0]?.value ?? 0;
  const showSkip = goalData != null && currentCount < goalData.frequency;

  const goalText = goalData ? getTitle(goalData) : null;

  const compliance = goalData
    ? tileColor(
        {
          frequency: goalData.frequency,
          regularity: goalData.regularity,
          createdAt: goalData.createdAt,
        },
        currentCount,
        schedules,
        complianceColors,
      )
    : null;

  return (
    <HabitDetail
      loading={!habitData}
      title={habitData?.title ?? ""}
      description={habitData?.description ?? null}
      goalText={goalText}
      regularity={goalData?.regularity ?? null}
      frequency={goalData?.frequency ?? null}
      checkInsThisPeriod={currentCount}
      schedules={schedules}
      checkIns={checkIns ?? []}
      complianceColor={compliance?.color}
      showSkip={showSkip}
      onCheckIn={async () => {
        await processCommand(db, { type: "CreateCheckIn", habitId });
      }}
      onSkip={async () => {
        await processCommand(db, {
          type: "CreateCheckIn",
          habitId,
          skipped: true,
        });
      }}
      onEdit={() => router.push(`/edit-habit/${habitId}`)}
      onRemoveCheckIn={async (checkInId) => {
        await processCommand(db, { type: "DeleteCheckIn", checkInId });
      }}
    />
  );
};

export default HabitScreen;
