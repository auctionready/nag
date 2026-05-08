import { useMemo } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { endOfDay } from "date-fns";
import { checkInsForHabitsOnDay } from "@nag/core";
import { db } from "../../../../db";
import { useStartOfToday } from "../../../../infrastructure/today";

interface BoardProgress {
  /** Number of distinct habits with ≥1 (non-skipped) check-in today. */
  doneCount: number;
  /** Total number of habits on the board. */
  totalCount: number;
  /** Today-compliance, 0..100 rounded. */
  percent: number;
  /** Cheeky one-liner derived from doneCount / totalCount. */
  line: string;
}

/**
 * Computes today's compliance for the home board header. Treats a habit
 * as "done today" if it has at least one non-skipped check-in stamped to
 * today's date. Coarse — a multi-slot habit only needs one — but matches
 * the design's "3 of 5 done" framing.
 */
export const useBoardProgress = (habitIds: string[]): BoardProgress => {
  const dayStart = useStartOfToday();
  const dayEnd = useMemo(() => endOfDay(dayStart), [dayStart]);

  const { data: rows } = useLiveQuery(
    checkInsForHabitsOnDay(db, habitIds, dayStart, dayEnd),
    [habitIds.join(","), dayStart.getTime(), dayEnd.getTime()],
  );

  const doneCount = useMemo(() => {
    if (!rows) return 0;
    const done = new Set<string>();
    for (const r of rows) {
      if (!r.skipped) done.add(r.habitId);
    }
    return done.size;
  }, [rows]);

  const totalCount = habitIds.length;
  const percent =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return {
    doneCount,
    totalCount,
    percent,
    line: lineFor(doneCount, totalCount),
  };
};

const lineFor = (done: number, total: number): string => {
  if (total === 0) return "set up your first habit.";
  if (done === 0) return "tick tick tick. nothing yet.";
  if (done === total) return "all done. nice.";
  const remaining = total - done;
  if (remaining === 1) return `${done} of ${total} done. one to go.`;
  return `${done} of ${total} done. ${remaining} to go.`;
};
