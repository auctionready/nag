import { StyleSheet, Text, View } from "react-native";
import { format } from "date-fns";
import type { MatchCheckInsToTimeSlotsResult } from "@nag/core";
import { ProgressRing } from "../../components/progress-ring";
import { complianceColors } from "../../components/compliance";
import { TimeSlotChip } from "./TimeSlotChip";
import { FrequencyDots } from "./FrequencyDots";

interface TodayCardProps {
  /**
   * The selected day. Used for the weekday label, and (in the parent) as the
   * anchor for `matchCheckInsToTime-slots`.
   */
  selectedDay: Date;
  /**
   * True when `selectedDay` is the current wall-clock day; controls whether
   * the headline says "done today" (vs. just "done" for retrospective views).
   */
  isToday: boolean;
  /** Null if this habit has no timed time-slots — we fall back to FrequencyDots. */
  match: MatchCheckInsToTimeSlotsResult | null;
  /** Used when `match` is null — how many check-ins this period vs. target. */
  fallback?: {
    completed: number;
    frequency: number;
  };
  /**
   * True when the habit has schedules but none cover the selected day's
   * day-of-week. Takes precedence over `fallback` so a weekly Mon/Wed/Fri
   * habit doesn't show period progress on Tuesday.
   */
  notScheduledForDay?: boolean;
  ringColor: string;
  /**
   * Long-press handler for a time-slot chip: supply the time-slot's hour/minute so the
   * screen can build a Date on the selected day. Only `missed`/`upcoming`
   * chips trigger this.
   */
  onAddCheckInForTimeSlot?: (hour: number, minute: number) => void;
}

export const TodayCard = ({
  selectedDay,
  isToday,
  match,
  fallback,
  notScheduledForDay,
  ringColor,
  onAddCheckInForTimeSlot,
}: TodayCardProps) => {
  const hasTimeSlots = match !== null && match.total > 0;
  const progress = hasTimeSlots
    ? (match.done + match.extras) / Math.max(1, match.total)
    : !notScheduledForDay && fallback
      ? fallback.completed / Math.max(1, fallback.frequency)
      : 0;
  const clampedProgress = Math.min(1, progress);
  const headline = hasTimeSlots
    ? `${match.done} of ${match.total} done${isToday ? " today" : ""}`
    : notScheduledForDay
      ? "Not scheduled"
      : fallback
        ? `${fallback.completed} of ${fallback.frequency} this period`
        : `Nothing scheduled${isToday ? " today" : ""}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <ProgressRing
          progress={clampedProgress}
          size={64}
          strokeWidth={6}
          color={ringColor}
          trackColor="#e8e8e8"
        />
        <View style={styles.headerText}>
          <Text style={styles.day}>{format(selectedDay, "EEEE")}</Text>
          <Text style={styles.headline}>{headline}</Text>
        </View>
      </View>

      {hasTimeSlots ? (
        <View style={styles.timeSlotRow}>
          {/* Back-fill policy: any past `missed` timeSlot, plus the *next-up*
              upcoming timeSlot today (so the user can record "I'm doing it
              now" a few minutes before the timeSlot). On past/future days
              there is no nearest-upcoming concept. */}
          {(() => {
            const firstUpcomingIdx = isToday
              ? match.timeSlots.findIndex((s) => s.status === "upcoming")
              : -1;
            return match.timeSlots.map((timeSlot, i) => {
              const backfillable =
                timeSlot.status === "missed" || i === firstUpcomingIdx;
              return (
                <TimeSlotChip
                  key={`${timeSlot.hour}:${timeSlot.minute}:${i}`}
                  hour={timeSlot.hour}
                  minute={timeSlot.minute}
                  status={timeSlot.status}
                  onLongPress={
                    backfillable && onAddCheckInForTimeSlot
                      ? () =>
                          onAddCheckInForTimeSlot(
                            timeSlot.hour,
                            timeSlot.minute,
                          )
                      : undefined
                  }
                />
              );
            });
          })()}
          {match.extras > 0 && (
            <View style={styles.extraPill}>
              <Text style={styles.extraText}>+{match.extras} extra</Text>
            </View>
          )}
        </View>
      ) : notScheduledForDay ? null : fallback ? (
        <FrequencyDots
          frequency={fallback.frequency}
          completed={fallback.completed}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f7f7f9",
    borderRadius: 12,
    padding: 16,
    gap: 16,
    // Stabilize the card height so switching between scheduled days
    // (chips visible) and unscheduled days ("Not scheduled" — no body)
    // doesn't make surrounding UI jump up and down. Sized to fit ring
    // (64) + gap (16) + ~one chip row (32) + vertical padding (32).
    minHeight: 144,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  day: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginTop: 2,
  },
  timeSlotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  extraPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: complianceColors.default,
    justifyContent: "center",
  },
  extraText: {
    fontSize: 13,
    fontWeight: "600",
    color: complianceColors.default,
  },
});
