import { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import type { Regularity } from "@nag/schema";
import {
  matchCheckInsToSlots,
  periodStart,
  type ScheduleInfo,
  type MatchCheckInsToSlotsResult,
} from "@nag/core";
import { complianceColors } from "../getComplianceColor";
import { TodayCard } from "./TodayCard";
import { WeekStrip } from "./WeekStrip";
import { RecentCheckIns, type RecentCheckInItem } from "./RecentCheckIns";

export interface HabitDetailProps {
  loading?: boolean;
  title: string;
  description: string | null;
  goalText: string | null;
  regularity: Regularity | null;
  frequency: number | null;
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
   * missed slot chip passes the slot's timestamp on the selected day.
   */
  onCheckInAt: (timestamp: Date) => void;
  /** Skip with the given deemed timestamp (symmetric with `onCheckInAt`). */
  onSkipAt: (timestamp: Date) => void;
  onEdit: () => void;
  onRemoveCheckIn: (checkInId: number) => void;
  /** Injectable for tests; defaults to new Date() on each render. */
  now?: Date;
}

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const periodWindow = (
  regularity: Regularity | null,
  now: Date,
): { start: Date; end: Date; title: string } => {
  if (regularity === "week") {
    const start = periodStart("week", now);
    return { start, end: endOfDay(now), title: "This Week's Check-ins" };
  }
  if (regularity === "month") {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
      title: "This Month's Check-ins",
    };
  }
  // default: day (also fallback when regularity is null)
  return {
    start: startOfDay(now),
    end: endOfDay(now),
    title: "Today's Check-ins",
  };
};

export const HabitDetail = ({
  loading,
  title,
  description,
  goalText,
  regularity,
  frequency,
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
  now = new Date(),
}: HabitDetailProps) => {
  const cardAnchor = useMemo(() => {
    if (!selectedDay) return now;
    // For the current day, keep the real "now" so upcoming slots render as
    // such. For past/future selected days, anchor at end-of-day so every
    // unmatched slot reads as "missed" (retrospective view).
    return isSameCalendarDay(selectedDay, now) ? now : endOfDay(selectedDay);
  }, [selectedDay, now]);

  const cardIsToday = isSameCalendarDay(cardAnchor, now);

  const match: MatchCheckInsToSlotsResult | null = useMemo(() => {
    if (schedules.length === 0) return null;
    const result = matchCheckInsToSlots({
      schedules,
      // `c.timestamp` is the deemed slot time — exactly what the matcher
      // needs to bucket a back-filled check-in to the right slot.
      checkIns: checkIns.map((c) => ({
        timestamp: c.timestamp,
        skipped: c.skipped,
      })),
      now: cardAnchor,
    });
    return result.total === 0 ? null : result;
  }, [schedules, checkIns, cardAnchor]);

  const scheduledDaysMask = useMemo(
    () => schedules.reduce((mask, s) => mask | (s.days ?? 0), 0),
    [schedules],
  );

  const checkedInDaysMask = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // back to Sunday
    let mask = 0;
    for (const c of checkIns) {
      if (c.timestamp >= start && c.timestamp <= now) {
        mask |= 1 << c.timestamp.getDay();
      }
    }
    return mask;
  }, [checkIns, now]);

  const { windowStart, windowEnd, listTitle } = useMemo(() => {
    if (selectedDay) {
      return {
        windowStart: startOfDay(selectedDay),
        windowEnd: endOfDay(selectedDay),
        listTitle: `${format(selectedDay, "EEEE")}'s Check-ins`,
      };
    }
    const { start, end, title } = periodWindow(regularity, now);
    return { windowStart: start, windowEnd: end, listTitle: title };
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

  const handleCheckInFooter = () => {
    // If the user has a non-today day selected, back-fill to that day at the
    // current H:M; otherwise check-in for right now.
    onCheckInAt(buildFooterTimestamp(selectedDay, now));
  };
  const handleSkipFooter = () => {
    onSkipAt(buildFooterTimestamp(selectedDay, now));
  };

  const handleAddCheckInForSlot = (hour: number, minute: number) => {
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
    // Long-press is overloaded: the user might want to record the slot as
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
            match={match}
            fallback={
              match === null && frequency !== null && frequency > 0
                ? {
                    completed: checkInsThisPeriod,
                    frequency,
                  }
                : undefined
            }
            ringColor={ringColor}
            onAddCheckInForSlot={handleAddCheckInForSlot}
          />
        )}

        {showWeekStrip && (
          <WeekStrip
            scheduledDaysMask={scheduledDaysMask}
            checkedInDaysMask={checkedInDaysMask}
            todayColor={complianceColor}
            now={now}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        )}

        <RecentCheckIns
          checkIns={filteredCheckIns}
          title={listTitle}
          onRemove={onRemoveCheckIn}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.checkInButton} onPress={handleCheckInFooter}>
          <Text style={styles.checkInButtonText}>Check-in</Text>
        </Pressable>
        {showSkip && (
          <Pressable style={styles.skipButton} onPress={handleSkipFooter}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        )}
        <Pressable style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
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
