import { StyleSheet, View, type ViewStyle } from "react-native";
import { buildMonthCells } from "@nag/core";
import { tokens } from "../theme";

interface MonthIndicatorsProps {
  checkIns: { timestamp: Date }[];
  now?: Date;
}

export const MonthIndicators = ({ checkIns, now }: MonthIndicatorsProps) => {
  const cells = buildMonthCells(checkIns, now);
  // Render as a 2-row grid (~15 columns) to mirror the design's mini month
  // strip: today is brand orange, done is ink, past with no check-in is
  // faint, future is an empty bordered cell.
  return (
    <View style={styles.grid}>
      {cells.map(({ dayNumber, hasCheckIn, isToday, isFuture }) => {
        const cellStyle: ViewStyle[] = [styles.cell];
        if (isToday) cellStyle.push(styles.cellToday);
        else if (hasCheckIn) cellStyle.push(styles.cellDone);
        else if (isFuture) cellStyle.push(styles.cellFuture);
        else cellStyle.push(styles.cellPast);
        return <View key={dayNumber} style={cellStyle} />;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  cell: {
    flexBasis: "5.5%",
    aspectRatio: 1,
    borderRadius: 2,
  },
  cellToday: {
    backgroundColor: tokens.orange,
  },
  cellDone: {
    backgroundColor: tokens.ink,
  },
  cellPast: {
    backgroundColor: tokens.faint,
  },
  cellFuture: {
    borderWidth: 1,
    borderColor: tokens.faint,
  },
});
