import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter } from "expo-router";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { db } from "../db";
import { checkIn, goal, getTitle, type Regularity } from "@nag/schema";
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

export function HabitTile({ id, title }: HabitTileProps) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const { data: goals } = useLiveQuery(
    db
      .select({
        frequency: goal.frequency,
        regularity: goal.regularity,
        createdAt: goal.createdAt,
      })
      .from(goal)
      .where(eq(goal.habitId, id))
      .limit(1),
  );
  const goalData = goals?.[0];
  const goalText = goalData ? getTitle(goalData) : null;

  const periodStartIso = goalData
    ? periodStart(goalData.regularity as Regularity)
    : null;

  const { data: countRows } = useLiveQuery(
    db
      .select({ value: count() })
      .from(checkIn)
      .where(
        periodStartIso
          ? and(eq(checkIn.habitId, id), gte(checkIn.timestamp, periodStartIso))
          : eq(checkIn.habitId, id),
      ),
  );
  const checkInCount = countRows?.[0]?.value ?? 0;

  const color = tileColor(goalData ?? null, checkInCount);

  const { data: recentCheckIns } = useLiveQuery(
    db
      .select({ timestamp: checkIn.timestamp })
      .from(checkIn)
      .where(
        periodStartIso
          ? and(eq(checkIn.habitId, id), gte(checkIn.timestamp, periodStartIso))
          : eq(checkIn.habitId, id),
      )
      .orderBy(desc(checkIn.timestamp))
      .limit(3),
  );

  const handlePress = useCallback(async () => {
    await db.insert(checkIn).values({ habitId: id });

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
    <Pressable
      onPress={handlePress}
      onLongPress={() => router.push(`/habit/${id}`)}
      style={styles.wrapper}
    >
      <Animated.View
        style={[
          styles.tile,
          { backgroundColor: color, transform: [{ scale }] },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        {goalText && <Text style={styles.subtitle}>{goalText}</Text>}
        {goalData ? (
          <Text style={styles.periodCount}>
            {checkInCount > 0
              ? `${formatCount(checkInCount)} ${periodLabels[goalData.regularity as Regularity]}`
              : `none ${periodLabels[goalData.regularity as Regularity]}`}
          </Text>
        ) : (
          checkInCount === 0 && (
            <Text style={styles.periodCount}>no check-ins</Text>
          )
        )}
        {recentCheckIns && recentCheckIns.length > 0 && (
          <Text style={styles.lastCheckIn}>
            {recentCheckIns
              .map((c) =>
                formatDistanceToNow(new Date(c.timestamp), { addSuffix: true }),
              )
              .join(" · ")}
          </Text>
        )}
      </Animated.View>
    </Pressable>
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
