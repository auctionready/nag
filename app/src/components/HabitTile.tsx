import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { db } from "../db";
import { getTitle, type Regularity } from "@nag/schema";
import {
  goalForHabit,
  checkInCount,
  recentCheckIns,
  processCommand,
} from "@nag/core";
import { periodStart, tileColor } from "./getComplianceColor";

const periodLabels: Record<Regularity, string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

function formatCount(n: number): string {
  return n < smallNumbers.length ? smallNumbers[n] : String(n);
}

interface HabitTileProps {
  id: number;
  title: string;
}

const useHabitGoalSummary = (habitId: number) => {
  const { data: goals } = useLiveQuery(goalForHabit(db, habitId), [habitId]);

  const goalData = goals?.[0];
  if (!goalData) return null;

  return {
    regularity: goalData.regularity,
    frequency: goalData.frequency,
    title: getTitle(goalData),
    createdAt: goalData.createdAt,
  };
};

export type HabitGoalSummary = NonNullable<
  ReturnType<typeof useHabitGoalSummary>
>;

const useHabitCompliance = (habitId: number, goal: HabitGoalSummary | null) => {
  const periodStartDate = goal ? periodStart(goal.regularity) : undefined;

  const { data: countRows } = useLiveQuery(
    checkInCount(db, habitId, periodStartDate),
    [habitId, periodStartDate],
  );

  const count = countRows?.[0]?.value ?? 0;

  const { data: recent } = useLiveQuery(
    recentCheckIns(db, habitId, periodStartDate),
    [habitId, periodStartDate],
  );

  return {
    checkInCount: count,
    recentCheckIns: recent ?? [],
  };
};

export function HabitTile({ id, title }: HabitTileProps) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => router.push(`/habit/${id}`));

  const goal = useHabitGoalSummary(id);
  const { checkInCount: count, recentCheckIns: recent } = useHabitCompliance(
    id,
    goal,
  );

  const color = tileColor(goal, count);

  const handlePress = useCallback(async () => {
    await processCommand(db, { type: "CreateCheckIn", habitId: id });

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [id, scale]);

  return (
    <GestureDetector gesture={longPress}>
      <Pressable onPress={handlePress} style={styles.wrapper}>
        <Animated.View
          style={[
            styles.tile,
            { backgroundColor: color, transform: [{ scale }] },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          {goal && <Text style={styles.subtitle}>{goal.title}</Text>}
          {goal ? (
            <Text style={styles.periodCount}>
              {count > 0
                ? `${formatCount(count)} ${periodLabels[goal.regularity]}`
                : `none ${periodLabels[goal.regularity]}`}
            </Text>
          ) : (
            count === 0 && <Text style={styles.periodCount}>no check-ins</Text>
          )}
          {recent.length > 0 && (
            <Text style={styles.lastCheckIn}>
              {recent
                .map((c) =>
                  formatDistanceToNow(c.timestamp, { addSuffix: true }),
                )
                .join(" · ")}
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  tile: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#fff",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  periodCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 6,
  },
  lastCheckIn: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 3,
    textAlign: "center",
  },
});
