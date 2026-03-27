import { useMemo } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { isSameDay, startOfDay } from "date-fns";
import { db } from "../db";
import { calendarCheckIns } from "@nag/core";

export type CalendarCheckIn = {
  id: number;
  timestamp: Date;
  skipped: boolean;
  habitId: number;
  habitTitle: string;
};

export function useCalendarCheckIns() {
  const { data: allCheckIns } = useLiveQuery(calendarCheckIns(db));

  const checkInsByDate = useMemo(() => {
    const map = new Map<string, CalendarCheckIn[]>();
    if (!allCheckIns) return map;
    for (const ci of allCheckIns) {
      const key = startOfDay(ci.timestamp).toISOString();
      const existing = map.get(key);
      if (existing) {
        existing.push(ci);
      } else {
        map.set(key, [ci]);
      }
    }
    return map;
  }, [allCheckIns]);

  return { allCheckIns, checkInsByDate };
}

export function useSelectedDayCheckIns(
  selectedDay: Date | null,
  allCheckIns: CalendarCheckIn[] | undefined,
) {
  return useMemo(() => {
    if (!selectedDay || !allCheckIns) return [];
    return allCheckIns.filter((ci) => isSameDay(ci.timestamp, selectedDay));
  }, [selectedDay, allCheckIns]);
}
