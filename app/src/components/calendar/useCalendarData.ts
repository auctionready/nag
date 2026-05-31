import { useMemo } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { addDays, isAfter, isSameDay, startOfDay } from "date-fns";
import {
  allHabits,
  allSchedules,
  calendarCheckIns,
  createGetDayAgenda,
  goalsForHabits,
  type DayAgenda,
  type DayAgendaItem,
} from "@nag/core";
import { db } from "../../db";
import { useStartOfToday } from "../../infrastructure/today";
import type { HabitIconKind } from "../glyphs";
import type { CellState } from "../habit-detail/CellGlyph";
import { cellStateForDay, type DayKind } from "./cellStateForDay";

export interface CalendarCheckIn {
  id: string;
  timestamp: Date;
  skipped: boolean;
  habitId: string;
  habitTitle: string;
}

export interface CalendarHabit {
  id: string;
  title: string;
  icon: HabitIconKind | null;
  /** Combined bitmask of all schedule days; 0 means "no schedule". */
  scheduledDaysMask: number;
  /** Per-day target frequency (1 for weekly/monthly habits). */
  perDayTarget: number;
}

export interface DayCheckInGroup {
  habitId: string;
  title: string;
  icon: HabitIconKind | null;
  checkIns: { id: string; timestamp: Date; skipped: boolean }[];
}

export interface PerDayCheckIn {
  id: string;
  timestamp: Date;
  skipped: boolean;
}

export type { DayAgenda, DayAgendaItem };

export interface WeekRow {
  habit: CalendarHabit;
  states: CellState[];
  /** Per-day check-ins (chronological), indexed 0..6 matching `states`. */
  perDay: PerDayCheckIn[][];
}

const dayKey = (habitId: string, timestamp: Date): string =>
  `${habitId}::${startOfDay(timestamp).getTime()}`;

/**
 * One-stop calendar data hook. Loads every habit, schedule, goal and
 * check-in once, then offers derived views:
 *   - `weekRows(weekStart)`: per-habit per-day classification for a 7-day window
 *   - `dayGroups(day)`: check-ins on `day` grouped by habit
 *   - `monthHeat(day)`: total/done/skip counts across every habit for one day
 *
 * Each habit's `scheduledDaysMask` and `perDayTarget` are derived defensively:
 * mask is the OR of every schedule's `days`; target is the goal frequency if
 * the goal is daily, otherwise 1 (weekly/monthly goals don't have a per-day
 * frequency).
 */
export const useCalendarData = () => {
  const today = useStartOfToday();

  const { data: habits } = useLiveQuery(allHabits(db));
  const { data: checkIns } = useLiveQuery(calendarCheckIns(db));
  // Reminder-agnostic: the calendar shows a habit's scheduled slots even
  // when its push reminders are off (e.g. seed data sets reminder=false).
  const { data: schedules } = useLiveQuery(allSchedules(db));

  const habitIds = useMemo(() => (habits ?? []).map((h) => h.id), [habits]);
  const habitIdsKey = habitIds.join(",");
  const { data: goals } = useLiveQuery(goalsForHabits(db, habitIds), [
    habitIdsKey,
  ]);

  const calendarHabits = useMemo<CalendarHabit[]>(() => {
    if (!habits) return [];
    const dayMaskByHabit = new Map<string, number>();
    for (const s of schedules ?? []) {
      const prev = dayMaskByHabit.get(s.habitId) ?? 0;
      dayMaskByHabit.set(s.habitId, prev | (s.days ?? 0));
    }
    const goalByHabit = new Map<
      string,
      { frequency: number; regularity: string }
    >();
    for (const g of goals ?? []) {
      goalByHabit.set(g.habitId, {
        frequency: g.frequency,
        regularity: g.regularity,
      });
    }
    return habits.map((h) => {
      const goal = goalByHabit.get(h.id);
      const perDayTarget =
        goal && goal.regularity === "day" ? Math.max(1, goal.frequency) : 1;
      return {
        id: h.id,
        title: h.title,
        icon: (h.icon ?? null) as HabitIconKind | null,
        scheduledDaysMask: dayMaskByHabit.get(h.id) ?? 0,
        perDayTarget,
      };
    });
  }, [habits, schedules, goals]);

  const checkInsByHabitDay = useMemo(() => {
    const map = new Map<string, PerDayCheckIn[]>();
    const sorted = (checkIns ?? [])
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const c of sorted) {
      const k = dayKey(c.habitId, c.timestamp);
      const entry: PerDayCheckIn = {
        id: c.id,
        timestamp: c.timestamp,
        skipped: c.skipped,
      };
      const list = map.get(k);
      if (list) list.push(entry);
      else map.set(k, [entry]);
    }
    return map;
  }, [checkIns]);

  const weekRows = useMemo(
    () =>
      (weekStart: Date): WeekRow[] => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        return calendarHabits.map((habit) => {
          const perDay: PerDayCheckIn[][] = [];
          const states = days.map((day) => {
            const dayCheckIns =
              checkInsByHabitDay.get(dayKey(habit.id, day)) ?? [];
            perDay.push(dayCheckIns);
            const dayKind: DayKind = isSameDay(day, today)
              ? "today"
              : isAfter(day, today)
                ? "future"
                : "past";
            return cellStateForDay({
              checkIns: dayCheckIns,
              scheduledDaysMask: habit.scheduledDaysMask,
              frequency: habit.perDayTarget,
              dayOfWeek: day.getDay(),
              dayKind,
            });
          });
          return { habit, states, perDay };
        });
      },
    [calendarHabits, checkInsByHabitDay, today],
  );

  const dayGroups = useMemo(
    () =>
      (day: Date): DayCheckInGroup[] => {
        const groups = new Map<string, DayCheckInGroup>();
        for (const c of checkIns ?? []) {
          if (!isSameDay(c.timestamp, day)) continue;
          const existing = groups.get(c.habitId);
          const habit = calendarHabits.find((h) => h.id === c.habitId);
          if (existing) {
            existing.checkIns.push({
              id: c.id,
              timestamp: c.timestamp,
              skipped: c.skipped,
            });
          } else {
            groups.set(c.habitId, {
              habitId: c.habitId,
              title: c.habitTitle,
              icon: habit?.icon ?? null,
              checkIns: [
                { id: c.id, timestamp: c.timestamp, skipped: c.skipped },
              ],
            });
          }
        }
        return Array.from(groups.values()).sort((a, b) => {
          const ta = a.checkIns[0].timestamp.getTime();
          const tb = b.checkIns[0].timestamp.getTime();
          return ta - tb;
        });
      },
    [checkIns, calendarHabits],
  );

  const monthHeat = useMemo(
    () => (day: Date) => {
      let total = 0;
      let skips = 0;
      for (const habit of calendarHabits) {
        const list = checkInsByHabitDay.get(dayKey(habit.id, day)) ?? [];
        for (const c of list) {
          total++;
          if (c.skipped) skips++;
        }
      }
      return { total, skips, done: total - skips };
    },
    [calendarHabits, checkInsByHabitDay],
  );

  const schedulesByHabit = useMemo(() => {
    const map = new Map<
      string,
      {
        days: number | null;
        dayOfMonth: number | null;
        hour: number | null;
        minute: number | null;
      }[]
    >();
    for (const s of schedules ?? []) {
      const list = map.get(s.habitId) ?? [];
      list.push({
        days: s.days,
        dayOfMonth: s.dayOfMonth,
        hour: s.hour,
        minute: s.minute,
      });
      map.set(s.habitId, list);
    }
    return map;
  }, [schedules]);

  const checkInsByHabit = useMemo(() => {
    const map = new Map<
      string,
      { id: string; timestamp: Date; skipped: boolean }[]
    >();
    for (const c of checkIns ?? []) {
      const list = map.get(c.habitId) ?? [];
      list.push({ id: c.id, timestamp: c.timestamp, skipped: c.skipped });
      map.set(c.habitId, list);
    }
    return map;
  }, [checkIns]);

  const dayAgenda = useMemo(() => {
    const getDayAgenda = createGetDayAgenda({
      habits: calendarHabits,
      schedulesByHabit,
      checkInsByHabit,
    });
    // `today` is start-of-day (midnight); the core builder needs wall-
    // clock time so overdue vs. upcoming flips correctly through the day.
    return (day: Date): DayAgenda => getDayAgenda(day, new Date());
  }, [calendarHabits, schedulesByHabit, checkInsByHabit]);

  return {
    today,
    habits: calendarHabits,
    weekRows,
    dayGroups,
    dayAgenda,
    monthHeat,
  };
};
