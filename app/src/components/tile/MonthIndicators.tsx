import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { buildMonthCells } from "@nag/core";
import { tokens } from "../theme";

interface MonthIndicatorsProps {
  checkIns: { timestamp: Date }[];
  now?: Date;
}

// Mirrors the design's MonthStrip cell language:
//   today-done — ink fill + check + orange ring
//   today      — orange ring, empty
//   done       — ink fill + check
//   missed     — faint ring, transparent (calendar negative space)
//   future     — very-faint fill, no border
const COLUMNS = 10;

export const MonthIndicators = ({ checkIns, now }: MonthIndicatorsProps) => {
  const cells = buildMonthCells(checkIns, now);
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += COLUMNS) {
    rows.push(cells.slice(i, i + COLUMNS));
  }
  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(({ dayNumber, hasCheckIn, isToday, isFuture }) => {
            const cellStyle: ViewStyle[] = [styles.cell];
            let inner: React.ReactNode = null;

            if (isToday && hasCheckIn) {
              cellStyle.push(styles.cellInk, styles.cellTodayRing);
              inner = <CheckGlyph />;
            } else if (isToday) {
              cellStyle.push(styles.cellTodayRing);
            } else if (hasCheckIn) {
              cellStyle.push(styles.cellInk);
              inner = <CheckGlyph />;
            } else if (isFuture) {
              cellStyle.push(styles.cellFuture);
            } else {
              cellStyle.push(styles.cellMissed);
            }

            return (
              <View key={dayNumber} style={cellStyle}>
                {inner}
              </View>
            );
          })}
          {/* Pad short trailing rows so cells stay aligned with the 10-col grid. */}
          {row.length < COLUMNS &&
            Array.from({ length: COLUMNS - row.length }).map((_, i) => (
              <View key={`pad-${i}`} style={styles.cellSpacer} />
            ))}
        </View>
      ))}
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellSpacer: {
    flex: 1,
    aspectRatio: 1,
  },
  cellInk: {
    backgroundColor: tokens.ink,
  },
  cellTodayRing: {
    borderWidth: 1.5,
    borderColor: tokens.orange,
  },
  cellMissed: {
    borderWidth: 1,
    borderColor: tokens.faint,
  },
  cellFuture: {
    backgroundColor: tokens.veryFaint,
  },
});
