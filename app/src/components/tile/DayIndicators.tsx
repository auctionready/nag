import { StyleSheet, Text, View } from "react-native";
import { buildDayCells } from "@nag/core";

const CHECKED_IN_COLOR = "#34C759";
const CIRCLE_SIZE = 24;

interface DayIndicatorsProps {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  partialDaysMask?: number;
  anyCheckInDaysMask?: number;
  todayColor?: string;
  partialColor?: string;
  missedColor?: string;
}

export const DayIndicators = ({
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask,
  anyCheckInDaysMask,
  todayColor,
  partialColor,
  missedColor,
}: DayIndicatorsProps) => {
  const cells = buildDayCells({
    scheduledDaysMask,
    checkedInDaysMask,
    partialDaysMask,
    anyCheckInDaysMask,
    checkedInColor: CHECKED_IN_COLOR,
    partialColor,
    todayColor,
    missedColor,
  });
  return (
    <View style={styles.row}>
      {cells.map(({ letter, scheduled, backgroundColor }, i) => {
        // Unscheduled day with a check-in: dim the whole circle to match
        // the faded letter so the check-in is visible but reads as "extra".
        const unscheduledFilled = !scheduled && backgroundColor !== undefined;
        return (
          <View key={i} style={styles.cell}>
            <View
              style={[
                styles.circle,
                backgroundColor ? { backgroundColor } : null,
                unscheduledFilled && styles.unscheduledFilled,
              ]}
            >
              <Text
                style={[
                  styles.letter,
                  !scheduled && !unscheduledFilled && styles.unscheduledLetter,
                ]}
              >
                {letter}
              </Text>
            </View>
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
  },
  cell: {
    flex: 1,
    alignItems: "center",
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  letter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  unscheduledLetter: {
    opacity: 0.35,
  },
  unscheduledFilled: {
    opacity: 0.35,
  },
});
