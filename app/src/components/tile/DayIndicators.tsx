import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { mondayFirstDayLetters } from "@nag/core";
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

type CellState = "done" | "partial" | "today" | "missed" | "future" | "off";

interface Cell {
  letter: string;
  state: CellState;
  isToday: boolean;
}

const buildCells = (
  {
    scheduledDaysMask,
    checkedInDaysMask,
    partialDaysMask = 0,
    anyCheckInDaysMask = 0,
  }: DayIndicatorsProps,
  now: Date = new Date(),
): Cell[] => {
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
    if (scheduled && checkedIn) state = "done";
    else if (!scheduled && anyCheckIn) state = "done";
    else if (isToday && scheduled) state = "today";
    else if (scheduled && partial) state = "partial";
    else if (scheduled && isPast) state = "missed";
    else if (scheduled) state = "future";
    else state = "off";
    return { letter, state, isToday };
  });
};

export const DayIndicators = (props: DayIndicatorsProps) => {
  const cells = buildCells(props);
  return (
    <View style={styles.row}>
      {cells.map((cell, i) => (
        <Cell key={i} {...cell} />
      ))}
    </View>
  );
};

const Cell = ({ letter, state, isToday }: Cell) => {
  const cellStyle: ViewStyle[] = [styles.cell];
  let icon: React.ReactNode = null;
  switch (state) {
    case "done":
      cellStyle.push(styles.cellDone);
      icon = (
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
      break;
    case "today":
      cellStyle.push(styles.cellToday);
      icon = <View style={styles.todayDot} />;
      break;
    case "partial":
      cellStyle.push(styles.cellToday);
      icon = <View style={styles.todayDot} />;
      break;
    case "missed":
      cellStyle.push(styles.cellMissed);
      icon = <View style={styles.missedDot} />;
      break;
    case "future":
      cellStyle.push(styles.cellFuture);
      break;
    case "off":
      cellStyle.push(styles.cellOff);
      break;
  }
  return (
    <View style={styles.col}>
      <Text style={[styles.letter, isToday && styles.letterToday]}>
        {letter}
      </Text>
      <View style={cellStyle}>{icon}</View>
    </View>
  );
};

const CELL = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  letter: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    letterSpacing: 0.6,
    color: tokens.mute,
    fontWeight: "400",
  },
  letterToday: {
    color: tokens.orange,
    fontWeight: "700",
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cellDone: {
    backgroundColor: tokens.ink,
  },
  cellToday: {
    backgroundColor: tokens.orange,
  },
  cellMissed: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.faint,
  },
  cellFuture: {
    borderWidth: 1,
    borderColor: tokens.faint,
  },
  cellOff: {
    borderWidth: 1,
    borderColor: tokens.veryFaint,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.cream,
  },
  missedDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tokens.faint,
  },
});
