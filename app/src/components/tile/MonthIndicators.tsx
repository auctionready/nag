import { StyleSheet, View } from "react-native";
import { buildMonthCells } from "@nag/core";

const CHECKED_IN_COLOR = "#34C759";
const TICK_HEIGHT_PAST = 24;
const TICK_HEIGHT_FUTURE = 14;

interface MonthIndicatorsProps {
  checkIns: { timestamp: Date }[];
  now?: Date;
}

export const MonthIndicators = ({ checkIns, now }: MonthIndicatorsProps) => {
  const cells = buildMonthCells(checkIns, now);
  return (
    <View style={styles.row}>
      {cells.map(({ dayNumber, hasCheckIn, isPast, isFuture }) => {
        const height = isFuture ? TICK_HEIGHT_FUTURE : TICK_HEIGHT_PAST;
        const backgroundColor = hasCheckIn
          ? CHECKED_IN_COLOR
          : "rgba(255,255,255,1)";
        const opacity = isFuture ? 0.12 : isPast && !hasCheckIn ? 0.3 : 1;
        return (
          <View key={dayNumber} style={styles.cell}>
            <View style={[styles.tick, { height, backgroundColor, opacity }]} />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    bottom: 10,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  cell: {
    flex: 1,
    alignItems: "center",
  },
  tick: {
    width: 3,
    borderRadius: 1.5,
  },
});
