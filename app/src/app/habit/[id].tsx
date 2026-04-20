import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { parse, format, startOfToday } from "date-fns";
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

const DAY_PARAM_FORMAT = "yyyy-MM-dd";

const HabitScreen = () => {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
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

  // `day` query param (YYYY-MM-DD) is a routing construct, not component
  // state — it survives navigation and is bookmarkable. For weekly habits
  // with a `days` mask we default to "today is selected" (highlight today
  // in the week strip, scope the list to today's check-ins) — without that
  // default, the week strip would show no selection and the long-press
  // affordances on slot chips would feel disconnected from the strip above.
  const hasWeeklyDaysSchedule =
    goalData?.regularity === "week" &&
    schedules.some((s) => (s.days ?? 0) !== 0);
  const parsedDay = day ? parse(day, DAY_PARAM_FORMAT, new Date()) : null;
  // Ignore a `?day=` pointing at the future — a deep link shouldn't bypass
  // the UI guard that prevents check-in / skip on days that haven't happened.
  const selectedDay =
    parsedDay && parsedDay <= startOfToday()
      ? parsedDay
      : hasWeeklyDaysSchedule
        ? startOfToday()
        : null;

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

  const handleSelectDay = (nextDay: Date | null) => {
    // Guard against future-day selection at the route-param boundary as
    // well as the UI; the WeekStrip already disables future cells, but
    // this keeps a stray `?day=` URL from bypassing the guard.
    if (nextDay && nextDay > startOfToday()) return;
    router.setParams({
      day: nextDay ? format(nextDay, DAY_PARAM_FORMAT) : undefined,
    });
  };

  const handleCheckInAt = async (timestamp: Date) => {
    await processCommand(db, { type: "CreateCheckIn", habitId, timestamp });
  };

  const handleSkipAt = async (timestamp: Date) => {
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      timestamp,
      skipped: true,
    });
  };

  const handleEditCheckInTimestamp = async (
    checkInId: number,
    timestamp: Date,
    skipped?: boolean,
  ) => {
    await processCommand(db, {
      type: "UpdateCheckIn",
      checkInId,
      timestamp,
      skipped,
    });
  };

  return (
    <HabitDetail
      loading={!habitData}
      title={habitData?.title ?? ""}
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
      onSelectDay={handleSelectDay}
      onCheckInAt={handleCheckInAt}
      onSkipAt={handleSkipAt}
      onEdit={() => router.push(`/edit-habit/${habitId}`)}
      onRemoveCheckIn={async (checkInId) => {
        await processCommand(db, { type: "DeleteCheckIn", checkInId });
      }}
      onEditCheckInTimestamp={handleEditCheckInTimestamp}
    />
  );
};

export default HabitScreen;
