import { useMemo } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { endOfDay } from "date-fns";
import {
  boardProgress,
  checkInsForHabitsOnDay,
  goalsForHabits,
  schedulesForHabits,
  type BoardProgressHabit,
  type BoardProgressResult,
} from "@nag/core";
import { db } from "../../db";
import {
  epochMinuteToDate,
  useCurrentEpochMinute,
  useStartOfToday,
} from "../../infrastructure/today";

interface BoardProgress extends BoardProgressResult {
  /** Cheeky one-liner derived from the aggregate. */
  line: string;
  /** Total habits on the board (including those with no goal). */
  totalCount: number;
}

/**
 * Today's compliance for the home board header. Sums each habit's
 * expected time-slots-by-now and credited check-ins. See `boardProgress` in
 * `@nag/core` for the per-habit rules.
 */
export const useBoardProgress = (habitIds: string[]): BoardProgress => {
  const dayStart = useStartOfToday();
  const dayEnd = useMemo(() => endOfDay(dayStart), [dayStart]);
  const epochMinute = useCurrentEpochMinute();
  const habitIdsKey = habitIds.join(",");

  const { data: checkIns } = useLiveQuery(
    checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd),
    [habitIdsKey, dayStart.getTime(), dayEnd.getTime()],
  );
  const { data: goals } = useLiveQuery(goalsForHabits(db, habitIds), [
    habitIdsKey,
  ]);
  const { data: schedules } = useLiveQuery(schedulesForHabits(db, habitIds), [
    habitIdsKey,
  ]);

  return useMemo(() => {
    const now = epochMinuteToDate(epochMinute);
    const goalByHabit = new Map<string, BoardProgressHabit["goal"]>();
    for (const g of goals ?? []) {
      goalByHabit.set(g.habitId, {
        frequency: g.frequency,
        regularity: g.regularity,
      });
    }
    const schedulesByHabit = new Map<string, BoardProgressHabit["schedules"]>();
    for (const s of schedules ?? []) {
      const list = schedulesByHabit.get(s.habitId) ?? [];
      list.push({
        days: s.days,
        dayOfMonth: s.dayOfMonth,
        hour: s.hour,
        minute: s.minute,
      });
      schedulesByHabit.set(s.habitId, list);
    }
    const doneByHabit = new Map<string, number>();
    for (const c of checkIns ?? []) {
      if (c.skipped) continue;
      doneByHabit.set(c.habitId, (doneByHabit.get(c.habitId) ?? 0) + 1);
    }

    const inputs: BoardProgressHabit[] = habitIds.map((id) => ({
      goal: goalByHabit.get(id) ?? null,
      schedules: schedulesByHabit.get(id) ?? [],
      doneToday: doneByHabit.get(id) ?? 0,
    }));

    const result = boardProgress(inputs, now);
    return {
      ...result,
      totalCount: habitIds.length,
      line: lineFor(result, habitIds.length),
    };
  }, [habitIds, epochMinute, goals, schedules, checkIns]);
};

const lineFor = (r: BoardProgressResult, totalCount: number): string => {
  if (totalCount === 0) return "set up your first habit.";
  if (r.nothingDueYet) {
    return r.extras > 0
      ? `${r.extras} done early. nothing due yet.`
      : "nothing due yet.";
  }
  if (r.expected === 0) return "no goals set. nothing to track.";
  if (r.done === 0) return `0 of ${r.expected} due. tick tick tick.`;
  if (r.done >= r.expected) {
    return r.extras > 0
      ? `caught up. ${r.extras} extra done.`
      : "caught up so far. nice.";
  }
  const remaining = r.expected - r.done;
  if (remaining === 1) return `${r.done} of ${r.expected} done. one to go.`;
  return `${r.done} of ${r.expected} done. ${remaining} to go.`;
};
