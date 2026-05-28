import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { formatDistanceToNowStrict } from "date-fns";
import type { ScheduleInfo } from "@nag/core";
import type { HabitGoalSummary } from "./useHabitGoalSummary";
import {
  PeriodIndicators,
  type PeriodIndicatorsProps,
} from "./PeriodIndicators";
import type { TimeSlotDotState } from "./timeSlotDotState";
import { TileProgressChip, computeChipState } from "./TileProgressChip";
import { HabitGlyph, type HabitIconKind } from "../../components/glyphs";
import { tokens } from "../../components/theme";

export interface HabitTileViewProps {
  id: string;
  title: string;
  icon?: string | null;
  goal: HabitGoalSummary | null;
  /** Total check-ins in the goal's current period (week or month). */
  periodCheckInCount: number;
  recentCheckIns: { timestamp: Date }[];
  /** Schedule has 2+ time-slots on at least one day-of-week. */
  multiTimeSlotPerDay: boolean;
  /** All schedule rows for the habit. */
  schedules: ScheduleInfo[];
  isOffDay?: boolean;
  periodIndicators?: PeriodIndicatorsProps;
  /**
   * Per-time-slot dot states for today, only when the habit has more than one
   * time-slot in a day (multi-time-slot daily frequency or multiple scheduled times).
   */
  todayTimeSlots?: TimeSlotDotState[];
  onPress: () => void;
  onCheckIn: () => Promise<void>;
}

export const HabitTileView = ({
  title,
  icon,
  goal,
  periodCheckInCount,
  recentCheckIns: recent,
  multiTimeSlotPerDay,
  schedules,
  periodIndicators,
  todayTimeSlots,
  onPress,
  onCheckIn,
}: HabitTileViewProps) => {
  const [scale] = useState(() => new Animated.Value(1));
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

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(500)
        .runOnJS(true)
        // onStart fires asynchronously when the gesture engages, not during render.
        // eslint-disable-next-line react-hooks/refs
        .onStart(() => {
          didLongPress.current = true;
          handleCheckIn();
        }),
    [handleCheckIn],
  );

  const chipState = computeChipState({
    goal,
    todayTimeSlots,
    periodCheckInCount,
    multiTimeSlotPerDay,
    schedules,
  });
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
            {chipState && <TileProgressChip state={chipState} />}
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
