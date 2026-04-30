import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { formatDistanceToNowStrict } from "date-fns";
import type { HabitGoalSummary } from "./useHabitGoalSummary";
import { cadenceLabel } from "./format";
import {
  PeriodIndicators,
  type PeriodIndicatorsProps,
} from "./PeriodIndicators";
import { HabitGlyph, type HabitIconKind } from "../HabitGlyph";
import { tokens } from "../theme";

export interface HabitTileViewProps {
  id: number;
  title: string;
  icon?: string | null;
  goal: HabitGoalSummary | null;
  checkInCount: number;
  recentCheckIns: { timestamp: Date }[];
  scheduleCount?: number;
  isOffDay?: boolean;
  periodIndicators?: PeriodIndicatorsProps;
  onPress: () => void;
  onCheckIn: () => Promise<void>;
}

export const HabitTileView = ({
  title,
  icon,
  goal,
  recentCheckIns: recent,
  scheduleCount,
  periodIndicators,
  onPress,
  onCheckIn,
}: HabitTileViewProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const didLongPress = useRef(false);

  const handleCheckIn = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.04,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    void onCheckIn();
  }, [onCheckIn, scale]);

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      didLongPress.current = true;
      handleCheckIn();
    });

  const cadence = cadenceLabel(goal, scheduleCount);
  const last = recent[0]?.timestamp;
  const lastLabel = last ? `${formatDistanceToNowStrict(last)} ago` : undefined;

  return (
    <GestureDetector gesture={longPress}>
      <Pressable
        onPress={() => {
          if (didLongPress.current) {
            didLongPress.current = false;
            return;
          }
          onPress();
        }}
        style={styles.wrapper}
      >
        <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <HabitGlyph
                kind={icon as HabitIconKind | null | undefined}
                size={18}
                color={tokens.ink}
              />
            </View>
            {cadence && (
              <View style={styles.cadenceChip}>
                <Text style={styles.cadenceText} numberOfLines={1}>
                  {cadence}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {lastLabel && <Text style={styles.lastCheckIn}>{lastLabel}</Text>}

          <View style={styles.spacer} />

          {periodIndicators && (
            <View style={styles.strip}>
              <PeriodIndicators {...periodIndicators} />
            </View>
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
    backgroundColor: tokens.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    shadowColor: tokens.ink,
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    minHeight: 156,
    flexDirection: "column",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cadenceChip: {
    backgroundColor: tokens.chipTint,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    maxWidth: "70%",
  },
  cadenceText: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: tokens.mute,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.16,
    lineHeight: 19,
  },
  lastCheckIn: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    marginTop: -4,
  },
  spacer: {
    flex: 1,
  },
  strip: {
    width: "100%",
  },
});
