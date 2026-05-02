import { useCallback } from "react";
import { useRouter } from "expo-router";
import {
  Day,
  habitProgressSnapshot,
  type SlotState,
  type MatchCheckInsToSlotsResult,
} from "@nag/core";
import { isSameDay } from "date-fns";
import { dispatch } from "../../infrastructure/dispatch";
import { complianceColors } from "../getComplianceColor";
import { useHabitGoalSummary } from "./useHabitGoalSummary";
import { useHabitCompliance } from "./useHabitCompliance";
import { HabitTileView } from "./HabitTileView";
import type { PeriodIndicatorsProps } from "./PeriodIndicators";
import type { SlotDotState } from "./TodaySlots";

interface HabitTileProps {
  id: number;
  title: string;
  icon?: string | null;
}

const ALL_DAYS_MASK = 0x7f; // Sun..Sat all set — every day "scheduled" for daily habits.

export const HabitTile = ({ id, title, icon }: HabitTileProps) => {
  const router = useRouter();
  const goal = useHabitGoalSummary(id);
  const {
    checkInCount,
    periodCheckIns,
    weekCheckIns,
    recentCheckIns,
    schedules,
  } = useHabitCompliance(id, goal);

  const now = new Date();
  const snap = habitProgressSnapshot({
    goal,
    schedules,
    periodCheckIns,
    periodCheckInCount: checkInCount,
    now,
    colors: complianceColors,
  });

  const isDaily = goal?.regularity === "day";
  const isWeekly = goal?.regularity === "week";
  const isMonthly = goal?.regularity === "month";
  const hasSchedule = isWeekly && snap.scheduledDaysMask !== 0;

  const effectiveScheduledMask = hasSchedule
    ? snap.scheduledDaysMask
    : snap.unscheduledWeeklyMask;
  const effectiveCheckedInMask = hasSchedule
    ? snap.completedDaysMask
    : snap.unscheduledWeeklyMask;
  const effectiveAnyCheckInMask = hasSchedule ? snap.anyCheckInDaysMask : 0;

  // Daily habits show a 7-day strip with every day "scheduled". Each day's
  // cell is "done" once the user hits goal.frequency check-ins, "partial"
  // when they've checked in but haven't yet, and "missed"/"future" when
  // empty — driven by classifyDailyWeek over this week's check-ins.
  const dailyMasks =
    isDaily && goal ? classifyDailyWeek(weekCheckIns, goal.frequency) : null;

  // Today's slot pips — only shown when there's >1 slot in a day. For
  // scheduled habits we map matchCheckInsToSlots' result; for daily-frequency
  // habits with frequency > 1 we synthesise pips from today's check-in count.
  const todaySlots = computeTodaySlots(
    goal,
    snap.slots,
    weekCheckIns,
    schedules.length,
    now,
  );

  const periodIndicators: PeriodIndicatorsProps | undefined = isMonthly
    ? { regularity: "month", checkIns: periodCheckIns, now }
    : dailyMasks
      ? {
          regularity: "day",
          scheduledDaysMask: ALL_DAYS_MASK,
          checkedInDaysMask: dailyMasks.completedDaysMask,
          partialDaysMask: dailyMasks.partialDaysMask,
        }
      : effectiveScheduledMask
        ? {
            regularity: "week",
            scheduledDaysMask: effectiveScheduledMask,
            checkedInDaysMask: effectiveCheckedInMask,
            partialDaysMask: hasSchedule ? snap.partialDaysMask : 0,
            anyCheckInDaysMask: effectiveAnyCheckInMask,
          }
        : undefined;

  const handlePress = useCallback(() => {
    router.push(`/habit/${id}`);
  }, [router, id]);

  const handleCheckIn = useCallback(async () => {
    await dispatch({
      type: "CreateCheckIn",
      habitId: id,
      timestamp: new Date(),
    });
  }, [id]);

  return (
    <HabitTileView
      id={id}
      title={title}
      icon={icon}
      goal={goal}
      checkInCount={checkInCount}
      recentCheckIns={recentCheckIns}
      scheduleCount={schedules.length}
      isOffDay={snap.isAnchorOffDay}
      periodIndicators={periodIndicators}
      todaySlots={todaySlots}
      onPress={handlePress}
      onCheckIn={handleCheckIn}
    />
  );
};

/**
 * Builds today's slot pip states for the tile's TodaySlots row. Returns
 * undefined when the habit doesn't have multiple slots in a day —
 * single-slot habits don't need the pip strip.
 *
 * Two modes:
 * - Scheduled habits with multiple timed slots today: map snap.slots'
 *   per-slot status (`done`/`upcoming`/`missed`/`skipped`) to dot states.
 *   A slot whose time is past but very recent → `behind`; older → `missed`.
 * - Daily-frequency habits with `frequency > 1` and no schedules: synthesise
 *   `frequency` pips from today's check-in count — first N done, rest pending.
 */
const computeTodaySlots = (
  goal: { regularity: string; frequency: number } | null,
  slots: MatchCheckInsToSlotsResult | null,
  weekCheckIns: { timestamp: Date }[],
  scheduleCount: number,
  now: Date,
): SlotDotState[] | undefined => {
  if (!goal) return undefined;

  // Scheduled habits with multiple timed slots today.
  if (slots && slots.total > 1) {
    return slots.slots.map((s) => mapSlotStatus(s, now));
  }

  // Daily frequency > 1 with no schedules → synthesise pips from today's
  // check-in count.
  if (goal.regularity === "day" && goal.frequency > 1 && scheduleCount === 0) {
    const todayCount = weekCheckIns.filter((c) =>
      isSameDay(c.timestamp, now),
    ).length;
    const total = goal.frequency;
    const done = Math.min(todayCount, total);
    const ahead = Math.max(0, todayCount - total);
    const out: SlotDotState[] = [];
    for (let i = 0; i < done; i++) out.push("done");
    for (let i = 0; i < total - done; i++) out.push("pending");
    for (let i = 0; i < ahead; i++) out.push("ahead");
    return out;
  }

  return undefined;
};

// "Recently missed" window: a missed slot whose scheduled time was within the
// last 90 minutes still has emotional gravity (orange ring) — older missed
// slots fade to a muted dot.
const RECENT_MISS_WINDOW_MIN = 90;

const mapSlotStatus = (slot: SlotState, now: Date): SlotDotState => {
  if (slot.status === "done" || slot.status === "skipped") return "done";
  if (slot.status === "upcoming") return "pending";
  // status === "missed"
  const slotMinutes = slot.hour * 60 + slot.minute;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const elapsed = nowMinutes - slotMinutes;
  return elapsed <= RECENT_MISS_WINDOW_MIN ? "behind" : "missed";
};

/**
 * For daily habits with `frequency` slots-per-day, classify each day of the
 * current week as done (>= frequency check-ins) or partial (1..frequency-1).
 * `frequency = 1` collapses to "done if any check-in".
 */
const classifyDailyWeek = (
  weekCheckIns: { timestamp: Date }[],
  frequency: number,
): { completedDaysMask: number; partialDaysMask: number } => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of weekCheckIns) {
    counts[c.timestamp.getDay()] += 1;
  }
  let completedDaysMask = 0;
  let partialDaysMask = 0;
  const target = Math.max(1, frequency);
  const dayBits = [
    Day.Sun,
    Day.Mon,
    Day.Tue,
    Day.Wed,
    Day.Thu,
    Day.Fri,
    Day.Sat,
  ];
  for (let dow = 0; dow < 7; dow++) {
    const n = counts[dow];
    if (n >= target) completedDaysMask |= dayBits[dow];
    else if (n > 0) partialDaysMask |= dayBits[dow];
  }
  return { completedDaysMask, partialDaysMask };
};
