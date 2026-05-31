import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { boardHabits } from "@nag/core";
import { HabitTile } from "../components/habit-tile";
import { Board } from "../components/board";

export const BoardScreen = () => {
  const router = useRouter();
  // `boardHabits` already excludes archived habits at the query level.
  const { data: habits } = useLiveQuery(boardHabits(db));

  // Paused habits are demoted to the end of the board, keeping their
  // existing relative order; the tile renders them greyed out.
  const ordered = useMemo(() => {
    if (!habits) return habits;
    return [
      ...habits.filter((h) => h.pausedAt == null),
      ...habits.filter((h) => h.pausedAt != null),
    ];
  }, [habits]);

  if (!ordered) {
    return null;
  }

  return (
    <Board
      habits={ordered}
      onAddHabit={() => router.push("/add-habit")}
      renderTile={(habit) => (
        <HabitTile
          id={habit.id}
          title={habit.title}
          icon={(habit as { icon?: string | null }).icon}
          paused={(habit as { pausedAt?: Date | null }).pausedAt != null}
        />
      )}
    />
  );
};
