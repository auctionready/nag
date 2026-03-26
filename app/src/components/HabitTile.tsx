import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter } from "expo-router";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { db } from "../db";
import { checkIn, goal, getTitle, type Regularity } from "@nag/schema";
import { periodStart, tileColor } from "./getComplianceColor";

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

  const { data: lastCheckIns } = useLiveQuery(
    db
      .select({ timestamp: checkIn.timestamp })
      .from(checkIn)
      .where(eq(checkIn.habitId, id))
      .orderBy(desc(checkIn.timestamp))
      .limit(1),
  );

  const lastCheckIn = lastCheckIns?.[0];

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
        {lastCheckIn && (
          <Text style={styles.lastCheckIn}>
            {formatDistanceToNow(new Date(lastCheckIn.timestamp), {
              addSuffix: true,
            })}
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
  lastCheckIn: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 6,
  },
});
