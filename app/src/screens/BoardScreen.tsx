import { useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";
import { HabitTile } from "../components/habit-tile";
import { Board } from "../components/board";

export const BoardScreen = () => {
  const router = useRouter();
  const { data: habits } = useLiveQuery(allHabits(db));

  if (!habits) {
    return null;
  }

  return (
    <Board
      habits={habits}
      onAddHabit={() => router.push("/add-habit")}
      renderTile={(habit) => (
        <HabitTile
          id={habit.id}
          title={habit.title}
          icon={(habit as { icon?: string | null }).icon}
        />
      )}
    />
  );
};
