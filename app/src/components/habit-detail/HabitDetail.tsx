import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
import { tokens } from "../../components/theme";
import { DetailHeader } from "./DetailHeader";
import { HeroCard } from "./HeroCard";
import { DetailWeekStrip } from "./DetailWeekStrip";
import { TimeSlotsCard } from "./time-slots";
import { CheckInsCard } from "./CheckInsCard";
import { ActionFooter } from "./ActionFooter";
import { ArchivedFooter } from "./ArchivedFooter";
import { StatusBanner, type HabitStatus } from "./StatusBanner";
import { CheckInDatePickerModal } from "./CheckInDatePickerModal";
import { cadenceSummary } from "./cadenceSummary";
import type { RecentCheckInItem } from "./types";

export interface HabitDetailProps {
  loading?: boolean;
  title: string;
  description: string | null;
  icon?: string | null;
  goalText: string | null;
  regularity: Regularity | null;
  frequency: number | null;
  /** Goal creation time — used by the weekly traffic-light. */
  goalCreatedAt?: Date | null;
  /** Check-ins within the current period (for frequency-only progress). */
  checkInsThisPeriod: number;
  schedules: ScheduleInfo[];
  checkIns: RecentCheckInItem[];
  /** Compliance color for today (used to tint within-day overlays). */
  complianceColor?: string;
  /**
   * Lifecycle status. Drives the indicator banner, the archived dim +
   * read-only footer, and the paused hint footer + slot back-fill gating.
   * Defaults to active.
   */
  status?: HabitStatus;
  /** When the habit was paused — caps which time-slots can be back-filled. */
  pausedAt?: Date | null;
  /** Resume a paused habit (from the banner). */
  onResume?: () => void;
  /** Unarchive an archived habit (from the banner / read-only footer). */
  onUnarchive?: () => void;
  /**
   * Whether new check-ins / skips can be recorded. False for archived
   * habits — the live footer and time-slot logging are replaced by a
   * read-only prompt. Paused habits can still be logged manually. Editing
   * existing check-ins is unaffected. Defaults to true.
   */
  interactive?: boolean;
  showSkip: boolean;
  /** The day the user has tapped on the week strip. */
  selectedDay: Date | null;
  onSelectDay: (day: Date | null) => void;
  /** Record a check-in / skip with the given deemed timestamp. */
  onCheckInAt: (timestamp: Date) => void;
  onSkipAt: (timestamp: Date) => void;
  onEdit: () => void;
  onBack: () => void;
  /** Navigate to the sibling history route. Hidden when not provided. */
  onOpenHistory?: () => void;
  onRemoveCheckIn: (checkInId: string) => void;
  onEditCheckInTimestamp: (
    checkInId: string,
    timestamp: Date,
    skipped?: boolean,
  ) => void;
}

/**
 * Habit detail screen — header (back · "habit" eyebrow · history + edit)
 * → hero (icon · title · cadence · note) → week strip → today's
 * scheduled slots (when any) → check-ins for the selected day → sticky
 * check-in / skip footer. The "How am I doing" panel lives on a sibling
 * `history` route reached from the bar-chart icon in the header.
 */
export const HabitDetail = ({
  loading,
  title,
  description,
  icon,
  goalText: _goalText,
  regularity,
  frequency,
  goalCreatedAt,
  checkInsThisPeriod,
  schedules,
  checkIns,
  complianceColor: _complianceColor,
  status = "active",
  pausedAt,
  onResume,
  onUnarchive,
  interactive = true,
  showSkip,
  selectedDay,
  onSelectDay,
  onCheckInAt,
  onSkipAt,
  onEdit,
  onBack,
  onOpenHistory,
  onRemoveCheckIn,
  onEditCheckInTimestamp,
}: HabitDetailProps) => {
  const epochMinute = useCurrentEpochMinute();
  const now = useMemo(() => epochMinuteToDate(epochMinute), [epochMinute]);

  const summary = useMemo(
    () => cadenceSummary({ regularity, frequency, schedules }),
    [regularity, frequency, schedules],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <DetailView
      title={title}
      description={description}
      icon={icon}
      summary={summary}
      regularity={regularity}
      frequency={frequency}
      goalCreatedAt={goalCreatedAt}
      checkInsThisPeriod={checkInsThisPeriod}
      schedules={schedules}
      checkIns={checkIns}
      status={status}
      pausedAt={pausedAt}
      onResume={onResume}
      onUnarchive={onUnarchive}
      interactive={interactive}
      showSkip={showSkip}
      selectedDay={selectedDay}
      onSelectDay={onSelectDay}
      onCheckInAt={onCheckInAt}
      onSkipAt={onSkipAt}
      onEdit={onEdit}
      onBack={onBack}
      onOpenHistory={onOpenHistory}
      onRemoveCheckIn={onRemoveCheckIn}
      onEditCheckInTimestamp={onEditCheckInTimestamp}
      now={now}
    />
  );
};

interface DetailViewProps {
  title: string;
  description: string | null;
  icon?: string | null;
  summary: string | null;
  regularity: Regularity | null;
  frequency: number | null;
  goalCreatedAt?: Date | null;
  checkInsThisPeriod: number;
  schedules: ScheduleInfo[];
  checkIns: RecentCheckInItem[];
  status: HabitStatus;
  pausedAt?: Date | null;
  onResume?: () => void;
  onUnarchive?: () => void;
  interactive: boolean;
  showSkip: boolean;
  selectedDay: Date | null;
  onSelectDay: (day: Date | null) => void;
  onCheckInAt: (timestamp: Date) => void;
  onSkipAt: (timestamp: Date) => void;
  onEdit: () => void;
  onBack: () => void;
  onOpenHistory?: () => void;
  onRemoveCheckIn: (checkInId: string) => void;
  onEditCheckInTimestamp: (
    checkInId: string,
    timestamp: Date,
    skipped?: boolean,
  ) => void;
  now: Date;
}

const DetailView = ({
  title,
  description,
  icon,
  summary,
  regularity,
  frequency,
  goalCreatedAt,
  checkInsThisPeriod,
  schedules,
  checkIns,
  status,
  pausedAt,
  onResume,
  onUnarchive,
  interactive,
  showSkip,
  selectedDay,
  onSelectDay,
  onCheckInAt,
  onSkipAt,
  onEdit,
  onBack,
  onOpenHistory,
  onRemoveCheckIn,
  onEditCheckInTimestamp,
  now,
}: DetailViewProps) => {
  const cardAnchor: Date = useMemo(
    () =>
      !selectedDay
        ? now
        : isSameCalendarDay(selectedDay, now)
          ? now
          : selectedDay < now
            ? endOfDay(selectedDay)
            : startOfDay(selectedDay),
    [selectedDay, now],
  );

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

  const { windowStart, windowEnd, listEyebrow, slotsEyebrow, singleDay } =
    useMemo(() => {
      if (selectedDay) {
        const isToday = isSameCalendarDay(selectedDay, now);
        const dayLabel = isToday
          ? "today"
          : format(selectedDay, "EEE · MMM d").toLowerCase();
        return {
          windowStart: startOfDay(selectedDay),
          windowEnd: endOfDay(selectedDay),
          listEyebrow: `${dayLabel} · check-ins`,
          slotsEyebrow: `${dayLabel} · schedule`,
          singleDay: true,
        };
      }
      const { start, end } = periodWindow(regularity, now);
      return {
        windowStart: start,
        windowEnd: end,
        listEyebrow: periodEyebrow(regularity),
        slotsEyebrow: "today · schedule",
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

  const showWeekStrip = regularity === "week" && snap.scheduledDaysMask !== 0;
  const slotsForDay = snap.timeSlots?.timeSlots ?? [];
  const cardIsToday = isSameCalendarDay(cardAnchor, now);

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

  const timeSlotTimestamp = (hour: number, minute: number): Date => {
    const anchor = selectedDay ?? now;
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate(),
      hour,
      minute,
      0,
      0,
    );
  };
  const handleCheckInForTimeSlot = (hour: number, minute: number) => {
    onCheckInAt(timeSlotTimestamp(hour, minute));
  };
  const handleSkipForTimeSlot = (hour: number, minute: number) => {
    onSkipAt(timeSlotTimestamp(hour, minute));
  };
  const handleDeleteForTimeSlot = (matchedAt: Date) => {
    const ms = matchedAt.getTime();
    const match = checkIns.find((c) => c.timestamp.getTime() === ms);
    if (match) onRemoveCheckIn(match.id);
  };

  const handleCheckInTap = () => {
    onCheckInAt(buildFooterTimestamp(selectedDay, new Date()));
  };
  const handleSkipTap = () => {
    onSkipAt(buildFooterTimestamp(selectedDay, new Date()));
  };
  const handleCheckInLongPress = () => {
    setPickerState({
      intent: { kind: "new-checkin" },
      timestamp: buildFooterTimestamp(selectedDay, new Date()),
    });
  };
  const handleSkipLongPress = () => {
    setPickerState({
      intent: { kind: "new-skip" },
      timestamp: buildFooterTimestamp(selectedDay, new Date()),
    });
  };

  return (
    <View style={styles.container}>
      <DetailHeader
        onBack={onBack}
        onEdit={onEdit}
        onOpenHistory={onOpenHistory}
        // Archived habits are read-only — bring them back from the status
        // banner before editing.
        showEdit={status !== "archived"}
      />
      <StatusBanner
        status={status}
        onResume={onResume ?? noop}
        onUnarchive={onUnarchive ?? noop}
      />
      <ScrollView
        style={[styles.scroll, status === "archived" && styles.dimmed]}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroCard
          icon={icon}
          title={title}
          cadenceSummary={summary}
          note={description}
        />

        {showWeekStrip && (
          <DetailWeekStrip
            scheduledDaysMask={snap.scheduledDaysMask}
            checkedInDaysMask={snap.completedDaysMask}
            partialDaysMask={snap.partialDaysMask}
            skippedDaysMask={snap.skippedDaysMask}
            anyCheckInDaysMask={snap.anyCheckInDaysMask}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        )}

        {slotsForDay.length > 0 && (
          <TimeSlotsCard
            eyebrow={slotsEyebrow}
            slots={slotsForDay}
            isToday={cardIsToday}
            slotDay={selectedDay ?? now}
            // Paused habits can still back-fill slots up to the pause
            // moment; later slots stay disabled.
            maxLogTime={
              status === "paused" ? (pausedAt ?? undefined) : undefined
            }
            onCheckInForTimeSlot={
              interactive ? handleCheckInForTimeSlot : undefined
            }
            onSkipForTimeSlot={interactive ? handleSkipForTimeSlot : undefined}
            onDeleteForTimeSlot={handleDeleteForTimeSlot}
          />
        )}

        <CheckInsCard
          checkIns={filteredCheckIns}
          eyebrow={listEyebrow}
          singleDay={singleDay}
          hasScheduleSlots={slotsForDay.length > 0}
          onRemove={onRemoveCheckIn}
          onEditTimestamp={(id, ts) =>
            setPickerState({
              intent: { kind: "edit", checkInId: id },
              timestamp: ts,
            })
          }
        />
      </ScrollView>

      {/* Archived is read-only; active and paused both log via the footer
          (paused logging still works — it just stops the nags). */}
      {status === "archived" ? (
        <ArchivedFooter onUnarchive={onUnarchive ?? noop} />
      ) : (
        <ActionFooter
          showSkip={showSkip}
          onCheckIn={handleCheckInTap}
          onLongPressCheckIn={handleCheckInLongPress}
          onSkip={handleSkipTap}
          onLongPressSkip={handleSkipLongPress}
        />
      )}

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

const noop = () => {};

const periodEyebrow = (regularity: Regularity | null): string => {
  if (regularity === "week") return "this week · check-ins";
  if (regularity === "month") return "this month · check-ins";
  return "today · check-ins";
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
    backgroundColor: tokens.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scroll: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.55,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 18,
  },
});
