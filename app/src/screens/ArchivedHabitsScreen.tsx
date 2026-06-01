import { useMemo } from "react";
import { router } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { format } from "date-fns";
import { getTitle } from "@nag/schema";
import { archivedHabits, goalsForHabits } from "@nag/core";
import { db } from "../db";
import {
  ArchivedHabitsList,
  type ArchivedHabit,
} from "../components/archived-habits";

/**
 * Accounts → Archived Habits (smart). Fetches archived habits and their
 * cadence, formats each row, and hands them to the dumb
 * {@link ArchivedHabitsList}. Tapping a row opens the habit detail page,
 * from which the edit screen's menu offers Unarchive.
 */
export const ArchivedHabitsScreen = () => {
  const { data: habits } = useLiveQuery(archivedHabits(db));
  const ids = useMemo(() => (habits ?? []).map((h) => h.id), [habits]);
  const { data: goals } = useLiveQuery(goalsForHabits(db, ids), [
    ids.join(","),
  ]);

  const cadenceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals ?? []) {
      map.set(
        g.habitId,
        getTitle({ frequency: g.frequency, regularity: g.regularity }),
      );
    }
    return map;
  }, [goals]);

  const rows = useMemo<ArchivedHabit[]>(() => {
    return (habits ?? []).map((h) => {
      const when = h.archivedAt
        ? `archived ${format(h.archivedAt, "d MMM")}`
        : "archived";
      const cadence = cadenceById.get(h.id);
      return {
        id: h.id,
        title: h.title,
        icon: h.icon ?? null,
        meta: cadence ? `${cadence} · ${when}` : when,
      };
    });
  }, [habits, cadenceById]);

  if (!habits) return null;

  return (
    <ArchivedHabitsList
      habits={rows}
      onOpen={(id) => router.push(`/habit/${id}`)}
    />
  );
};
