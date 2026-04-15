import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Regularity } from "@nag/schema";
import {
  matchCheckInsToSlots,
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
  onCheckIn: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onRemoveCheckIn: (checkInId: number) => void;
  /** Injectable for tests; defaults to new Date() on each render. */
  now?: Date;
}

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
  onCheckIn,
  onSkip,
  onEdit,
  onRemoveCheckIn,
  now = new Date(),
}: HabitDetailProps) => {
  const match: MatchCheckInsToSlotsResult | null = useMemo(() => {
    if (schedules.length === 0) return null;
    const result = matchCheckInsToSlots({
      schedules,
      checkIns: checkIns.map((c) => ({
        timestamp: c.timestamp,
        skipped: c.skipped,
      })),
      now,
    });
    return result.total === 0 ? null : result;
  }, [schedules, checkIns, now]);

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

  const ringColor = complianceColor ?? complianceColors.default;
  const showWeekStrip = regularity === "week" && scheduledDaysMask !== 0;

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
            now={now}
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
          />
        )}

        {showWeekStrip && (
          <WeekStrip
            scheduledDaysMask={scheduledDaysMask}
            checkedInDaysMask={checkedInDaysMask}
            todayColor={complianceColor}
          />
        )}

        <RecentCheckIns checkIns={checkIns} onRemove={onRemoveCheckIn} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.checkInButton} onPress={onCheckIn}>
          <Text style={styles.checkInButtonText}>Check-in</Text>
        </Pressable>
        {showSkip && (
          <Pressable style={styles.skipButton} onPress={onSkip}>
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
