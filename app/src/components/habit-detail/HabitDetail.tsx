import { useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import type { Regularity } from "@nag/schema";
import {
  habitProgressSnapshot,
  isSameCalendarDay,
  periodStart,
  periodWindow,
  type ScheduleInfo,
} from "@nag/core";
import {
  epochMinuteToDate,
  useCurrentEpochMinute,
} from "../../infrastructure/today";
import { complianceColors } from "../../components/compliance";
import { TodayCard } from "./TodayCard";
import { WeekStrip } from "./WeekStrip";
import { RecentCheckIns, type RecentCheckInItem } from "./RecentCheckIns";
import { CheckInDatePickerModal } from "./CheckInDatePickerModal";

export interface HabitDetailProps {
  loading?: boolean;
  /**
   * Optional time-slot for the "How am I doing" card — rendered after the
   * recent check-ins list. Passed in by the screen so this component
   * stays free of API/DB imports and remains trivially testable.
   */
  complianceHistorySlot?: React.ReactNode;
  title: string;
  description: string | null;
  goalText: string | null;
  regularity: Regularity | null;
  frequency: number | null;
  /** Goal creation time — used by the weekly traffic-light to avoid
   * penalising the current week when the goal was just created. */
  goalCreatedAt?: Date | null;
  /** Check-ins within the current period (for frequency-only progress). */
  checkInsThisPeriod: number;
  schedules: ScheduleInfo[];
  checkIns: RecentCheckInItem[];
  /** Compliance color for today (used to tint the progress ring and today circle). */
  complianceColor?: string;
  showSkip: boolean;
  /**
   * The day the user has tapped on the week strip, or `null` when no day is
   * selected (show the current period). Controls:
   *  - the TodayCard anchor & weekday label
   *  - the RecentCheckIns title + window filter
   *  - the WeekStrip's highlighted cell
   */
  selectedDay: Date | null;
  /** Called when the week strip is tapped. Pass `null` to clear selection. */
  onSelectDay: (day: Date | null) => void;
  /**
   * Record a check-in with the given deemed timestamp. Footer "Check-in"
   * passes `new Date()` (or a moment on the selected day); long-press on a
   * missed time-slot chip passes the time-slot's timestamp on the selected day.
   */
  onCheckInAt: (timestamp: Date) => void;
  /** Skip with the given deemed timestamp (symmetric with `onCheckInAt`). */
  onSkipAt: (timestamp: Date) => void;
  onEdit: () => void;
  onRemoveCheckIn: (checkInId: string) => void;
  onEditCheckInTimestamp: (
    checkInId: string,
    timestamp: Date,
    skipped?: boolean,
  ) => void;
}

const periodTitle = (regularity: Regularity | null): string => {
  if (regularity === "week") return "This Week's Check-ins";
  if (regularity === "month") return "This Month's Check-ins";
  return "Today's Check-ins";
};

export const HabitDetail = ({
  loading,
  complianceHistorySlot,
  title,
  description,
  goalText,
  regularity,
  frequency,
  goalCreatedAt,
  checkInsThisPeriod,
  schedules,
  checkIns,
  complianceColor,
  showSkip,
  selectedDay,
  onSelectDay,
  onCheckInAt,
  onSkipAt,
  onEdit,
  onRemoveCheckIn,
  onEditCheckInTimestamp,
}: HabitDetailProps) => {
  const { bottom: safeBottom } = useSafeAreaInsets();
  // `epochMinute` is stable across renders within the same minute, so every
  // useMemo below caches across re-render storms (e.g. `useLiveQuery`
  // refiring) and only recomputes when the clock crosses a minute
  // boundary or the calendar day rolls over.
  const epochMinute = useCurrentEpochMinute();
  const now = useMemo(() => epochMinuteToDate(epochMinute), [epochMinute]);

  const cardAnchor: Date = useMemo(
    () =>
      !selectedDay
        ? now
        : isSameCalendarDay(selectedDay, now)
          ? now
          : // Past day → end-of-day so unfilled timeSlots read as "missed" (red).
            // Future day → start-of-day so unfilled time-slots read as "upcoming"
            // (white). Without this split, future days would erroneously
            // paint upcoming time-slots red.
            selectedDay < now
            ? endOfDay(selectedDay)
            : startOfDay(selectedDay),
    [selectedDay, now],
  );

  // Scope check-ins to the current period so prior-period back-fills
  // don't leak into this period's masks. Uses periodStart (Monday-first
  // for `week`), which fixes the Sunday-boundary bug the old inline
  // `start.setDate(start.getDate() - start.getDay())` introduced.
  const snap = useMemo(() => {
    const periodStartDate = regularity ? periodStart(regularity, now) : null;
    const goal =
      regularity !== null && frequency !== null && goalCreatedAt != null
        ? { regularity, frequency, createdAt: goalCreatedAt }
        : null;
    return habitProgressSnapshot({
      goal,
      schedules,
      periodCheckIns: (periodStartDate
        ? checkIns.filter((c) => c.timestamp >= periodStartDate)
        : checkIns
      ).map((c) => ({ timestamp: c.timestamp, skipped: c.skipped })),
      periodCheckInCount: checkInsThisPeriod,
      now,
      anchor: cardAnchor,
      colors: complianceColors,
    });
  }, [
    regularity,
    frequency,
    goalCreatedAt,
    schedules,
    checkIns,
    checkInsThisPeriod,
    now,
    cardAnchor,
  ]);

  const match = snap.timeSlots;
  const cardIsToday = snap.headline.isToday;
  const notScheduledForDay = snap.anchorKind === "off-day";
  const scheduledDaysMask = snap.scheduledDaysMask;
  const checkedInDaysMask = snap.completedDaysMask;
  const partialDaysMask = snap.partialDaysMask;
  // Dim-fill any unscheduled day the user still checked in on, so those
  // back-fills aren't invisible in the week strip.
  const anyCheckInDaysMask = snap.anyCheckInDaysMask;

  const { windowStart, windowEnd, listTitle, singleDay } = useMemo(() => {
    if (selectedDay) {
      return {
        windowStart: startOfDay(selectedDay),
        windowEnd: endOfDay(selectedDay),
        listTitle: `${format(selectedDay, "EEEE")}'s Check-ins`,
        singleDay: true,
      };
    }
    const { start, end } = periodWindow(regularity, now);
    return {
      windowStart: start,
      windowEnd: end,
      listTitle: periodTitle(regularity),
      singleDay: regularity === "day" || regularity === null,
    };
  }, [selectedDay, regularity, now]);

  const filteredCheckIns = useMemo(
    () =>
      checkIns.filter(
        (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd,
      ),
    [checkIns, windowStart, windowEnd],
  );

  const ringColor = complianceColor ?? complianceColors.default;
  const showWeekStrip = regularity === "week" && scheduledDaysMask !== 0;

  type PickerIntent =
    | { kind: "edit"; checkInId: string }
    | { kind: "new-checkin" }
    | { kind: "new-skip" };

  const [pickerState, setPickerState] = useState<{
    intent: PickerIntent;
    timestamp: Date;
  } | null>(null);

  const pickerConfig = useMemo(() => {
    if (selectedDay) {
      return {
        mode: "time" as const,
        minimumDate: startOfDay(selectedDay),
        // Cap at now when editing a check-in on today so the user can't pick
        // a future time; past selected days are fully open (end-of-day).
        maximumDate: isSameCalendarDay(selectedDay, now)
          ? now
          : endOfDay(selectedDay),
      };
    }
    if (regularity === "week") {
      return {
        mode: "datetime" as const,
        minimumDate: periodStart("week", now),
        maximumDate: now,
      };
    }
    if (regularity === "month") {
      return {
        mode: "datetime" as const,
        minimumDate: startOfMonth(now),
        maximumDate: now,
      };
    }
    return {
      mode: "time" as const,
      minimumDate: startOfDay(now),
      maximumDate: now,
    };
  }, [selectedDay, regularity, now]);

  const handlePickerConfirm = (date: Date, skipped?: boolean) => {
    if (!pickerState) return;
    if (pickerState.intent.kind === "edit") {
      onEditCheckInTimestamp(pickerState.intent.checkInId, date, skipped);
    } else if (pickerState.intent.kind === "new-checkin") {
      onCheckInAt(date);
    } else if (pickerState.intent.kind === "new-skip") {
      onSkipAt(date);
    }
    setPickerState(null);
  };

  // Refs track whether a long press just fired so the Pressable.onPress
  // handler (which fires on finger-up) can skip the regular action.
  // Using Gesture.LongPress() instead of Pressable.onLongPress because
  // GestureHandlerRootView intercepts touches at the root and makes
  // Pressable.onLongPress unreliable — the same reason Time-slotChip and
  // HabitTileView use the gesture-handler API.
  const didCheckInLongPress = useRef(false);
  const didSkipLongPress = useRef(false);

  const checkInLongPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      didCheckInLongPress.current = true;
      setPickerState({
        intent: { kind: "new-checkin" },
        timestamp: buildFooterTimestamp(selectedDay, new Date()),
      });
    });

  const skipLongPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      didSkipLongPress.current = true;
      setPickerState({
        intent: { kind: "new-skip" },
        timestamp: buildFooterTimestamp(selectedDay, new Date()),
      });
    });

  const handleCheckInFooter = () => {
    if (didCheckInLongPress.current) {
      didCheckInLongPress.current = false;
      return;
    }
    // Use a fresh `new Date()` (not the captured-at-render `now` prop) so
    // the deemed timestamp matches `createdAt` for an immediate check-in.
    onCheckInAt(buildFooterTimestamp(selectedDay, new Date()));
  };
  const handleSkipFooter = () => {
    if (didSkipLongPress.current) {
      didSkipLongPress.current = false;
      return;
    }
    onSkipAt(buildFooterTimestamp(selectedDay, new Date()));
  };

  const handleAddCheckInForTimeSlot = (hour: number, minute: number) => {
    const anchor = selectedDay ?? now;
    const ts = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate(),
      hour,
      minute,
      0,
      0,
    );
    // Long-press is overloaded: the user might want to record the time-slot as
    // done, OR record it as skipped (e.g. "I missed my 8 a.m. run, but I
    // intentionally skipped it"). Prompt to disambiguate before writing.
    Alert.alert("Back-fill check-in?", `For ${format(ts, "h:mm a")}`, [
      { text: "Cancel", style: "cancel" },
      { text: "As Skip", onPress: () => onSkipAt(ts) },
      { text: "Check In", onPress: () => onCheckInAt(ts) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        {goalText && (
          <View style={styles.goalPill}>
            <Text style={styles.goalPillText}>{goalText}</Text>
          </View>
        )}

        {(match !== null ||
          (frequency !== null && frequency > 0 && regularity !== null)) && (
          <TodayCard
            selectedDay={cardAnchor}
            isToday={cardIsToday}
            // Only pass `match` when there are time-slots for the day; otherwise
            // suppress it so the card falls through to "Not scheduled" or
            // the frequency-only fallback.
            match={match !== null && match.total > 0 ? match : null}
            notScheduledForDay={notScheduledForDay}
            fallback={
              // Frequency-only fallback only applies when the habit has no
              // per-day schedules at all. If schedules exist but none for
              // the selected day, `notScheduledForDay` takes precedence.
              schedules.length === 0 && frequency !== null && frequency > 0
                ? {
                    completed: checkInsThisPeriod,
                    frequency,
                  }
                : undefined
            }
            ringColor={ringColor}
            onAddCheckInForTimeSlot={handleAddCheckInForTimeSlot}
          />
        )}

        {showWeekStrip && (
          <WeekStrip
            scheduledDaysMask={scheduledDaysMask}
            checkedInDaysMask={checkedInDaysMask}
            partialDaysMask={partialDaysMask}
            anyCheckInDaysMask={anyCheckInDaysMask}
            todayColor={complianceColor}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        )}

        <RecentCheckIns
          checkIns={filteredCheckIns}
          title={listTitle}
          singleDay={singleDay}
          onRemove={onRemoveCheckIn}
          onEditTimestamp={(id, ts) =>
            setPickerState({
              intent: { kind: "edit", checkInId: id },
              timestamp: ts,
            })
          }
        />

        {complianceHistorySlot}
      </ScrollView>

      <View
        style={[
          styles.footer,
          safeBottom > 0 && { paddingBottom: 16 + safeBottom },
        ]}
      >
        <GestureDetector gesture={checkInLongPressGesture}>
          <Pressable style={styles.checkInButton} onPress={handleCheckInFooter}>
            <Text style={styles.checkInButtonText}>Check-in</Text>
          </Pressable>
        </GestureDetector>
        {showSkip && (
          <GestureDetector gesture={skipLongPressGesture}>
            <Pressable style={styles.skipButton} onPress={handleSkipFooter}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          </GestureDetector>
        )}
        <Pressable style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      {pickerState && (
        <CheckInDatePickerModal
          visible
          initialDate={pickerState.timestamp}
          mode={pickerConfig.mode}
          minimumDate={pickerConfig.minimumDate}
          maximumDate={pickerConfig.maximumDate}
          showSkipToggle={pickerState.intent.kind === "edit"}
          initialSkipped={
            pickerState.intent.kind === "edit"
              ? (() => {
                  const intent = pickerState.intent;
                  return (
                    checkIns.find((c) => c.id === intent.checkInId)?.skipped ??
                    false
                  );
                })()
              : undefined
          }
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerState(null)}
        />
      )}
    </View>
  );
};

const buildFooterTimestamp = (selectedDay: Date | null, now: Date): Date => {
  if (!selectedDay || isSameCalendarDay(selectedDay, now)) return now;
  return new Date(
    selectedDay.getFullYear(),
    selectedDay.getMonth(),
    selectedDay.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    fontSize: 15,
    color: "#666",
    marginTop: -8,
  },
  goalPill: {
    alignSelf: "flex-start",
    backgroundColor: complianceColors.default,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: -8,
  },
  goalPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  checkInButton: {
    flex: 1,
    backgroundColor: complianceColors.default,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  checkInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: complianceColors.partial,
  },
  skipButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  editButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: complianceColors.default,
  },
  editButtonText: {
    color: complianceColors.default,
    fontSize: 16,
    fontWeight: "600",
  },
});
