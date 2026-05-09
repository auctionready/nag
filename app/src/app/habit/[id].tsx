import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { parse, format } from "date-fns";
import { db } from "../../db";
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
import { dispatch } from "../../infrastructure/dispatch";
import { useStartOfToday } from "../../infrastructure/today";
import { HabitDetail } from "../../components/habit-detail";
import { HabitHistoryView } from "../../components/habit-detail/HabitHistoryView";
import { cadenceSummary } from "../../components/habit-detail/cadenceSummary";
import { complianceColors } from "../../components/compliance";

const DAY_PARAM_FORMAT = "yyyy-MM-dd";

const HabitScreen = () => {
  const { id, day, view } = useLocalSearchParams<{
    id: string;
    day?: string;
    view?: string;
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

  const handleSetView = (nextView: "detail" | "history") => {
    router.setParams({ view: nextView === "history" ? "history" : undefined });
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

  const summary = cadenceSummary({
    regularity: goalData?.regularity ?? null,
    frequency: goalData?.frequency ?? null,
    schedules,
  });
  const historyView = habitData?.id ? (
    <HabitHistoryView
      habitExternalId={habitData.id}
      title={habitData.title}
      icon={habitData.icon ?? null}
      cadenceSummary={summary}
    />
  ) : null;

  return (
    <HabitDetail
      loading={!habitData}
      habitExternalId={habitData?.id ?? null}
      historyView={historyView}
      title={habitData?.title ?? ""}
      icon={habitData?.icon ?? null}
      description={habitData?.description ?? null}
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
      view={view === "history" ? "history" : "detail"}
      onSelectDay={handleSelectDay}
      onSetView={handleSetView}
      onCheckInAt={handleCheckInAt}
      onSkipAt={handleSkipAt}
      onEdit={() => router.push(`/edit-habit/${habitId}`)}
      onBack={() => router.back()}
      onRemoveCheckIn={async (checkInId) => {
        await dispatch({ type: "DeleteCheckIn", checkInId });
      }}
      onEditCheckInTimestamp={handleEditCheckInTimestamp}
    />
  );
};

export default HabitScreen;
