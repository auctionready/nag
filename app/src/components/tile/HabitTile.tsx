import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { db } from "../../db";
import { processCommand } from "@nag/core";
import { tileColor } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { periodLabels, formatCount } from "./format";

interface HabitTileProps {
  id: number;
  title: string;
}

export const HabitTile = ({ id, title }: HabitTileProps) => {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const didLongPress = useRef(false);

  const handleCheckIn = useCallback(async () => {
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

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      didLongPress.current = true;
      void handleCheckIn();
    });

  const goal = useHabitGoalSummary(id);
  const { checkInCount: count, recentCheckIns: recent } = useHabitCompliance(
    id,
    goal,
  );

  const color = tileColor(goal, count);

  return (
    <GestureDetector gesture={longPress}>
      <Pressable
        onPress={() => {
          if (didLongPress.current) {
            didLongPress.current = false;
            return;
          }
          router.push(`/habit/${id}`);
        }}
        style={styles.wrapper}
      >
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
};

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
