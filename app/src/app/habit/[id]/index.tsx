import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { parse, format } from "date-fns";
import { db } from "../../../db";
import { getTitle, seqUuid } from "@nag/schema";
import {
  habitById,
  goalForHabitFull,
  checkInsForHabit,
  checkInCount,
  combineScheduleDays,
  periodStart,
  schedulesForHabit,
  tileColor,
} from "@nag/core";
import { dispatch } from "../../../infrastructure/dispatch";
import { useStartOfToday } from "../../../infrastructure/today";
import {
  HabitDetail,
  type HabitStatus,
} from "../../../components/habit-detail";
import { complianceColors } from "../../../components/compliance";

const DAY_PARAM_FORMAT = "yyyy-MM-dd";

const HabitScreen = () => {
  const { id, day } = useLocalSearchParams<{
    id: string;
    day?: string;
  }>();
  const router = useRouter();
  const habitId = id ?? "";
  const todayStart = useStartOfToday();

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

  // `day` query param (YYYY-MM-DD) is a routing construct, not component
  // state — it survives navigation and is bookmarkable. For weekly habits
  // with a `days` mask we default to "today is selected".
  const hasWeeklyDaysSchedule =
    goalData?.regularity === "week" && combineScheduleDays(schedules) !== 0;
  const parsedDay = day ? parse(day, DAY_PARAM_FORMAT, todayStart) : null;
  const selectedDay =
    parsedDay && parsedDay <= todayStart
      ? parsedDay
      : hasWeeklyDaysSchedule
        ? todayStart
        : null;

  const periodStartDate = goalData
    ? periodStart(goalData.regularity, todayStart)
    : undefined;
  const periodStartKey = periodStartDate?.getTime() ?? 0;
  const { data: countRows } = useLiveQuery(
    checkInCount(db, habitId, periodStartDate),
    [habitId, periodStartKey],
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

  const handleSelectDay = (nextDay: Date | null) => {
    if (nextDay && nextDay > todayStart) return;
    router.setParams({
      day: nextDay ? format(nextDay, DAY_PARAM_FORMAT) : undefined,
    });
  };

  const handleCheckInAt = async (timestamp: Date) => {
    await dispatch({
      type: "CreateCheckIn",
      checkInId: seqUuid(),
      habitId,
      timestamp,
    });
  };

  const handleSkipAt = async (timestamp: Date) => {
    await dispatch({
      type: "CreateCheckIn",
      checkInId: seqUuid(),
      habitId,
      timestamp,
      skipped: true,
    });
  };

  const handleEditCheckInTimestamp = async (
    checkInId: string,
    timestamp: Date,
    skipped?: boolean,
  ) => {
    await dispatch({
      type: "UpdateCheckIn",
      checkInId,
      timestamp,
      skipped,
    });
  };

  const archived = habitData?.archivedAt != null;
  const paused = habitData?.pausedAt != null;
  const status: HabitStatus = archived
    ? "archived"
    : paused
      ? "paused"
      : "active";
  // Time-slot logging is available to active and paused habits (archived
  // is read-only). For paused, HabitDetail additionally gates each slot to
  // times up to `pausedAt` so only earlier slots can be back-filled.
  const interactive = !archived;

  return (
    <HabitDetail
      loading={!habitData}
      title={habitData?.title ?? ""}
      icon={habitData?.icon ?? null}
      description={habitData?.description ?? null}
      status={status}
      pausedAt={habitData?.pausedAt ?? null}
      onResume={() => dispatch({ type: "UnpauseHabit", habitId })}
      onUnarchive={() => dispatch({ type: "UnarchiveHabit", habitId })}
      interactive={interactive}
      goalText={goalText}
      regularity={goalData?.regularity ?? null}
      frequency={goalData?.frequency ?? null}
      goalCreatedAt={goalData?.createdAt ?? null}
      checkInsThisPeriod={currentCount}
      schedules={schedules}
      checkIns={checkIns ?? []}
      complianceColor={compliance?.color}
      showSkip={showSkip}
      selectedDay={selectedDay}
      onSelectDay={handleSelectDay}
      onCheckInAt={handleCheckInAt}
      onSkipAt={handleSkipAt}
      onEdit={() => router.push(`/habit/${habitId}/edit`)}
      onBack={() => router.back()}
      onOpenHistory={
        habitData?.id
          ? () => router.push(`/habit/${habitId}/history`)
          : undefined
      }
      onRemoveCheckIn={async (checkInId) => {
        await dispatch({ type: "DeleteCheckIn", checkInId });
      }}
      onEditCheckInTimestamp={handleEditCheckInTimestamp}
    />
  );
};

export default HabitScreen;
