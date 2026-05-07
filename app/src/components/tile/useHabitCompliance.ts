import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { startOfWeek } from "date-fns";
import {
  checkInCount,
  checkInsInPeriod,
  recentCheckIns,
  schedulesForHabit,
} from "@nag/core";
import type { ScheduleInfo } from "@nag/core";
import { db } from "../../db";
import { periodStart } from "../getComplianceColor";
import type { HabitGoalSummary } from "./useHabitGoalSummary";

export const useHabitCompliance = (
  habitId: string,
  goal: HabitGoalSummary | null,
) => {
  const periodStartDate = goal ? periodStart(goal.regularity) : undefined;
  // Keying deps by epoch ms keeps useLiveQuery's effect stable across renders
  // — passing the Date directly produces a fresh reference each render and
  // re-subscribes the change listener on every setData, locking the JS thread
  // in a render-then-resubscribe loop.
  const periodStartKey = periodStartDate?.getTime() ?? 0;

  const { data: countRows } = useLiveQuery(
    checkInCount(db, habitId, periodStartDate),
    [habitId, periodStartKey],
  );

  const count = countRows?.[0]?.value ?? 0;

  // Day-mask / ring / within-day color need *every* check-in in the period
  // — a limited query silently drops back-fills whose `timestamp` (deemed
  // slot time) sorts earlier than newer entries.
  const { data: periodCheckInRows } = useLiveQuery(
    periodStartDate
      ? checkInsInPeriod(db, habitId, periodStartDate)
      : checkInsInPeriod(db, habitId, new Date(0)),
    [habitId, periodStartKey],
  );

  // Display text on the tile only wants the handful most recent.
  const { data: recent } = useLiveQuery(
    recentCheckIns(db, habitId, periodStartDate, 3),
    [habitId, periodStartKey],
  );

  const { data: scheduleRows } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);

  // Daily habits' periodCheckIns is just today, but the week-strip needs to
  // paint earlier days too. Fetch this week's check-ins separately for them.
  const weekStartKey = useStableWeekStartKey();
  const { data: weekRows } = useLiveQuery(
    checkInsInPeriod(db, habitId, new Date(weekStartKey)),
    [habitId, weekStartKey],
  );

  const schedules: ScheduleInfo[] = scheduleRows ?? [];

  return {
    checkInCount: count,
    /** Every check-in in the current period (for masks/rings/within-day). */
    periodCheckIns: periodCheckInRows ?? [],
    /** Every check-in since this week's Monday — for the week strip. */
    weekCheckIns: weekRows ?? [],
    /** A short list for "X minutes ago · Y hours ago" display text only. */
    recentCheckIns: recent ?? [],
    schedules,
  };
};

// Returns the epoch ms of this week's Monday, stable for the lifetime of the
// week (so `useLiveQuery` doesn't re-subscribe on every render).
const useStableWeekStartKey = (): number =>
  startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
