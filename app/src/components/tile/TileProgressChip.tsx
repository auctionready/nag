import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { HabitGoalSummary } from "./useHabitGoalSummary";
import type { SlotDotState } from "./slotDotState";
import { tokens } from "../theme";

export type TileChipState =
  | { kind: "label"; text: string }
  | { kind: "dots"; slots: SlotDotState[]; prefixToday: boolean };

const labelByRegularity: Record<HabitGoalSummary["regularity"], string> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

interface ChipInputs {
  goal: HabitGoalSummary | null;
  /** Today's slot dot states — present when today has 1+ scheduled slots. */
  todaySlots: SlotDotState[] | undefined;
  /** Total check-ins in the goal's current period (week or month). */
  periodCheckInCount: number;
  /**
   * True when the habit's schedule has more than one slot on at least one
   * day of the week (e.g. "8am and 6pm on Mon/Wed/Fri"). Determines whether
   * weekly habits collapse to today-only progress.
   */
  multiSlotPerDay: boolean;
}

/**
 * Builds the top-right chip state for a habit tile.
 *
 * Cases:
 * - frequency=1 → text label ("daily" | "weekly" | "monthly")
 * - daily multi-frequency → today's slot dots (with "today" prefix)
 * - weekly with multi-slot-per-day schedules → today's slot dots (with prefix);
 *   when today is an off day with no slots, falls back to an "off today" label
 * - weekly otherwise → N=frequency dots filled from this week's check-in count
 *   (specific scheduled days act as a guide, not a gate)
 * - monthly multi-frequency → N=frequency dots filled from this month's count
 */
export const computeChipState = ({
  goal,
  todaySlots,
  periodCheckInCount,
  multiSlotPerDay,
}: ChipInputs): TileChipState | null => {
  if (!goal) return null;

  if (goal.frequency <= 1) {
    return { kind: "label", text: labelByRegularity[goal.regularity] };
  }

  if (goal.regularity === "day") {
    const slots = todaySlots ?? buildPeriodSlots(goal.frequency, 0);
    return { kind: "dots", slots, prefixToday: true };
  }

  if (goal.regularity === "week" && multiSlotPerDay) {
    if (todaySlots && todaySlots.length > 0) {
      return { kind: "dots", slots: todaySlots, prefixToday: true };
    }
    return { kind: "label", text: "off today" };
  }

  return {
    kind: "dots",
    slots: buildPeriodSlots(goal.frequency, periodCheckInCount),
    prefixToday: false,
  };
};

const buildPeriodSlots = (frequency: number, count: number): SlotDotState[] => {
  const done = Math.min(frequency, count);
  const ahead = Math.max(0, count - frequency);
  const out: SlotDotState[] = [];
  for (let i = 0; i < done; i++) out.push("done");
  for (let i = 0; i < frequency - done; i++) out.push("pending");
  for (let i = 0; i < ahead; i++) out.push("ahead");
  return out;
};

interface TileProgressChipProps {
  state: TileChipState;
}

export const TileProgressChip = ({ state }: TileProgressChipProps) => {
  if (state.kind === "label") {
    return (
      <View style={styles.chip}>
        <Text style={styles.text} numberOfLines={1}>
          {state.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.chip, styles.chipDots]}>
      {state.prefixToday && <Text style={styles.todayLabel}>today</Text>}
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

const SIZE = 7;

const styles = StyleSheet.create({
  chip: {
    backgroundColor: tokens.chipTint,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "75%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipDots: {
    paddingVertical: 5,
  },
  text: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: tokens.mute,
    textTransform: "uppercase",
  },
  todayLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: tokens.orange,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
