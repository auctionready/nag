import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ScheduleInfo } from "@nag/core";
import type { HabitGoalSummary } from "./useHabitGoalSummary";
import { slotStripStates, type SlotDotState } from "./slotDotState";
import { cadenceLabel, formatTime } from "../../components/formatters";
import { tokens } from "../../components/theme";

export type TileChipState =
  | { kind: "label"; text: string }
  | { kind: "dots"; slots: SlotDotState[]; prefixToday: boolean }
  | { kind: "labelDots"; text: string; slots: SlotDotState[] };

interface ChipInputs {
  goal: HabitGoalSummary | null;
  /** Today's slot dot states — present when today has 1+ scheduled slots. */
  todaySlots: SlotDotState[] | undefined;
  /** Total check-ins in the goal's current period. */
  periodCheckInCount: number;
  /** Schedule has 2+ slots on at least one day-of-week. */
  multiSlotPerDay: boolean;
  /** All schedule rows for the habit (specific days/times). */
  schedules: ScheduleInfo[];
}

const ALL_DAYS_MASK = 0x7f;

/**
 * If the habit has exactly one schedule row that fires every day at a
 * specific time, return a concise "7:30 PM daily" label — more useful on
 * the tile than the cadence-derived "7× / wk".
 */
const everyDayTimeLabel = (schedules: ScheduleInfo[]): string | null => {
  if (schedules.length !== 1) return null;
  const s = schedules[0];
  if (s.days !== ALL_DAYS_MASK) return null;
  if (s.hour == null || s.minute == null) return null;
  return `${formatTime(s.hour, s.minute)} daily`;
};

/**
 * Builds the top-right chip state for a habit tile.
 *
 * Cases:
 * - daily multi-frequency → today's slot dots (with "today" eyebrow)
 * - weekly + multi-slot-per-day → today's slot dots (with eyebrow); off-day
 *   fallback shows "off today"
 * - weekly/monthly + unscheduled (no schedule rows) → cadence label with
 *   N=frequency dots stacked beneath, filled from period check-in count.
 *   We always show at least one dot (even at frequency=1) so the tile
 *   communicates period completion at a glance.
 * - weekly + scheduled (single-slot-per-day) → text label "Nx / wk".
 *   The week-strip already paints the specific days, so dots would be
 *   redundant.
 * - monthly + scheduled → text label "Nx / mo". The month-strip carries
 *   the per-day detail.
 * - frequency=1 with schedules → text label ("daily" | "weekly" | "monthly")
 */
export const computeChipState = ({
  goal,
  todaySlots,
  periodCheckInCount,
  multiSlotPerDay,
  schedules,
}: ChipInputs): TileChipState | null => {
  if (!goal) return null;

  const dailyTime = everyDayTimeLabel(schedules);
  const isUnscheduled = schedules.length === 0;

  if (goal.regularity === "day" && goal.frequency > 1) {
    const slots = todaySlots ?? [...slotStripStates(goal.frequency, 0)];
    return { kind: "dots", slots, prefixToday: true };
  }

  if (
    isUnscheduled &&
    (goal.regularity === "week" || goal.regularity === "month")
  ) {
    return {
      kind: "labelDots",
      text: cadenceLabel(goal),
      slots: [...slotStripStates(goal.frequency, periodCheckInCount)],
    };
  }

  if (goal.frequency <= 1) {
    return { kind: "label", text: dailyTime ?? cadenceLabel(goal) };
  }

  if (goal.regularity === "week" && multiSlotPerDay) {
    if (todaySlots && todaySlots.length > 0) {
      return { kind: "dots", slots: todaySlots, prefixToday: true };
    }
    return { kind: "label", text: "off today" };
  }

  return { kind: "label", text: dailyTime ?? cadenceLabel(goal) };
};

interface TileProgressChipProps {
  state: TileChipState;
}

export const TileProgressChip = ({ state }: TileProgressChipProps) => {
  if (state.kind === "label") {
    return (
      <Text style={styles.text} numberOfLines={1}>
        {state.text}
      </Text>
    );
  }

  if (state.kind === "labelDots") {
    return (
      <View style={styles.column}>
        <Text style={styles.text} numberOfLines={1}>
          {state.text}
        </Text>
        <View style={styles.dots}>
          {state.slots.map((s, i) => (
            <Dot key={i} state={s} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {state.prefixToday && <Text style={styles.todayEyebrow}>today</Text>}
      <View style={styles.dots}>
        {state.slots.map((s, i) => (
          <Dot key={i} state={s} />
        ))}
      </View>
    </View>
  );
};

const Dot = ({ state }: { state: SlotDotState }) => {
  const style: ViewStyle[] = [styles.dot];
  switch (state) {
    case "done":
      style.push(styles.dotDone);
      break;
    case "ahead":
      style.push(styles.dotAhead);
      break;
    case "pending":
      style.push(styles.dotPending);
      break;
    case "behind":
      style.push(styles.dotBehind);
      break;
    case "missed":
      style.push(styles.dotMissed);
      break;
  }
  return <View style={style} />;
};

const SIZE = 9;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  column: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  text: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    letterSpacing: 0.72,
    color: tokens.mute,
    textTransform: "uppercase",
  },
  todayEyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.85,
    textTransform: "uppercase",
    color: tokens.orange,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  dotDone: {
    backgroundColor: tokens.ink,
  },
  dotAhead: {
    backgroundColor: tokens.orange,
  },
  dotPending: {
    borderWidth: 1.2,
    borderColor: tokens.faint,
  },
  dotBehind: {
    borderWidth: 1.2,
    borderColor: tokens.orange,
  },
  dotMissed: {
    backgroundColor: tokens.faint,
  },
});
