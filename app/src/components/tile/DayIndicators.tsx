import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { mondayFirstDayLetters } from "@nag/core";
import { useStartOfToday } from "../../infrastructure/today";
import { tokens } from "../theme";

interface DayIndicatorsProps {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  partialDaysMask?: number;
  anyCheckInDaysMask?: number;
  todayColor?: string;
  partialColor?: string;
  missedColor?: string;
}

interface BuildCellsArgs {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  partialDaysMask?: number;
  anyCheckInDaysMask?: number;
  now: Date;
}

// State language for week-strip cells, mirroring the design:
//   done           — ink fill + check
//   today-done     — done + orange ring around it
//   today          — scheduled today, not done — orange ring, empty inside
//   partial        — some-of-many slots done — bottom portion ink-filled,
//                    faint ring
//   today-partial  — partial + orange ring
//   missed         — past scheduled day with no check-in — faint ring + slash
//   future         — upcoming scheduled day — faint ring
//   skip           — not scheduled — past gets a faint fill, future a lighter
//                    fill (calendar negative space, with a subtle past/future
//                    shade difference)
type CellState =
  | "done"
  | "today-done"
  | "today"
  | "partial"
  | "today-partial"
  | "missed"
  | "future"
  | "skip";

interface Cell {
  letter: string;
  state: CellState;
  isToday: boolean;
  isPast: boolean;
}

const buildCells = ({
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask = 0,
  anyCheckInDaysMask = 0,
  now,
}: BuildCellsArgs): Cell[] => {
  const todayBit = 1 << now.getDay();
  const todayIndex = mondayFirstDayLetters.findIndex(
    ({ day }) => day === todayBit,
  );
  return mondayFirstDayLetters.map(({ day, letter }, i) => {
    const scheduled = (scheduledDaysMask & day) !== 0;
    const checkedIn = (checkedInDaysMask & day) !== 0;
    const partial = (partialDaysMask & day) !== 0;
    const anyCheckIn = (anyCheckInDaysMask & day) !== 0;
    const isToday = day === todayBit;
    const isPast = i < todayIndex;
    let state: CellState;
    if (scheduled && checkedIn) state = isToday ? "today-done" : "done";
    else if (!scheduled && anyCheckIn) state = "done";
    else if (scheduled && partial)
      state = isToday ? "today-partial" : "partial";
    else if (isToday && scheduled) state = "today";
    else if (scheduled && isPast) state = "missed";
    else if (scheduled) state = "future";
    else state = "skip";
    return { letter, state, isToday, isPast };
  });
};

export const DayIndicators = (props: DayIndicatorsProps) => {
  const todayStart = useStartOfToday();
  const cells = buildCells({ ...props, now: todayStart });
  return (
    <View style={styles.row}>
      {cells.map((cell, i) => (
        <Cell key={i} {...cell} />
      ))}
    </View>
  );
};

// Default partial fill — caller doesn't supply per-day ratios so use a
// neutral half-fill that reads as "partial" without implying a specific
// completion fraction.
const DEFAULT_PARTIAL_RATIO = 0.5;

const Cell = ({ letter, state, isToday, isPast }: Cell) => {
  const cellStyle: ViewStyle[] = [styles.cell];
  let inner: React.ReactNode = null;

  switch (state) {
    case "done":
      cellStyle.push(styles.cellInk);
      inner = <CheckGlyph />;
      break;
    case "today-done":
      cellStyle.push(styles.cellInk, styles.cellTodayRing);
      inner = <CheckGlyph />;
      break;
    case "today":
      cellStyle.push(styles.cellTodayRing);
      break;
    case "partial":
      cellStyle.push(styles.cellFaintRing);
      inner = <PartialFill ratio={DEFAULT_PARTIAL_RATIO} />;
      break;
    case "today-partial":
      cellStyle.push(styles.cellTodayRing);
      inner = <PartialFill ratio={DEFAULT_PARTIAL_RATIO} />;
      break;
    case "missed":
      cellStyle.push(styles.cellFaintRing);
      inner = <SlashGlyph />;
      break;
    case "future":
      cellStyle.push(styles.cellFaintRing);
      break;
    case "skip":
      cellStyle.push(isPast ? styles.cellEmptyPast : styles.cellEmptyFuture);
      break;
  }

  return (
    <View style={styles.col}>
      <Text style={[styles.letter, isToday && styles.letterToday]}>
        {letter}
      </Text>
      <View style={cellStyle}>{inner}</View>
    </View>
  );
};

const CheckGlyph = () => (
  <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
    <Path
      d="M2 4.5L4 6.5L7.5 2.5"
      stroke={tokens.cream}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SlashGlyph = () => (
  <Svg width="100%" height="100%" viewBox="0 0 22 22" fill="none">
    <Line
      x1={6}
      y1={16}
      x2={16}
      y2={6}
      stroke={tokens.mute}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  </Svg>
);

const PartialFill = ({ ratio }: { ratio: number }) => (
  <View
    style={[
      styles.partialFill,
      { height: `${Math.max(0, Math.min(1, ratio)) * 100}%` },
    ]}
  />
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
  },
  col: {
    flex: 1,
    alignItems: "stretch",
    gap: 4,
  },
  letter: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    letterSpacing: 0.6,
    color: tokens.mute,
    fontWeight: "400",
    textAlign: "center",
  },
  letterToday: {
    color: tokens.orange,
    fontWeight: "700",
  },
  cell: {
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  cellInk: {
    backgroundColor: tokens.ink,
  },
  cellTodayRing: {
    borderColor: tokens.orange,
  },
  cellFaintRing: {
    borderColor: tokens.faint,
  },
  cellEmptyPast: {
    backgroundColor: tokens.midFaint,
  },
  cellEmptyFuture: {
    backgroundColor: tokens.inkTint,
  },
  partialFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.ink,
  },
});
