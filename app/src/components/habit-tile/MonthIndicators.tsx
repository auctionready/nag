import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { buildMonthCells, type MonthDayCell } from "@nag/core";
import { useStartOfToday } from "../../infrastructure/today";
import { tokens } from "../../components/theme";

interface MonthIndicatorsProps {
  checkIns: { timestamp: Date; skipped?: boolean | null }[];
}

// Cell language for the monthly strip. Monthly habits don't carry a per-day
// schedule, so today is just a quiet "you are here" marker, not a "do this now"
// prompt; past unchecked days are calendar negative space (not "missed"):
//   today-done — ink fill + check (same as any done day)
//   today      — small orange dot, empty otherwise
//   done       — ink fill + check
//   past empty — faint fill (slightly stronger than future, to signal history)
//   future     — very subtle fill
const COLUMNS = 10;

export const MonthIndicators = ({ checkIns }: MonthIndicatorsProps) => {
  const todayStart = useStartOfToday();
  const cells = buildMonthCells(checkIns, todayStart);
  const rows: MonthDayCell[][] = [];
  for (let i = 0; i < cells.length; i += COLUMNS) {
    rows.push(cells.slice(i, i + COLUMNS));
  }
  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {Array.from({ length: COLUMNS }).map((_, colIndex) => {
            const day = row[colIndex];
            return day ? (
              <MonthCell key={day.dayNumber} day={day} />
            ) : (
              <View key={`pad-${colIndex}`} style={styles.cell} />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const MonthCell = ({ day }: { day: MonthDayCell }) => {
  const { hasCheckIn, isSkipped, isToday, isFuture } = day;
  const cellStyle: ViewStyle[] = [styles.cell];
  let inner: React.ReactNode = null;

  if (isSkipped) {
    cellStyle.push(styles.cellSkipped);
    inner = <SkippedDashGlyph />;
  } else if (hasCheckIn) {
    cellStyle.push(styles.cellInk);
    inner = <CheckGlyph />;
  } else if (isToday) {
    inner = <View style={styles.todayDot} />;
  } else if (isFuture) {
    cellStyle.push(styles.cellEmptyFuture);
  } else {
    cellStyle.push(styles.cellEmptyPast);
  }

  return <View style={cellStyle}>{inner}</View>;
};

const SkippedDashGlyph = () => (
  <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
    <Line
      x1={2}
      y1={4.5}
      x2={7}
      y2={4.5}
      stroke={tokens.cream}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

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

const styles = StyleSheet.create({
  grid: {
    flexDirection: "column",
    gap: 4,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellInk: {
    backgroundColor: tokens.ink,
  },
  cellSkipped: {
    backgroundColor: tokens.inkSkipped,
  },
  todayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tokens.orange,
  },
  cellEmptyPast: {
    backgroundColor: tokens.faint,
  },
  cellEmptyFuture: {
    backgroundColor: tokens.inkTint,
  },
});
