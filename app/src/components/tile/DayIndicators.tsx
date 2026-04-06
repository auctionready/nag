import { StyleSheet, Text, View } from "react-native";
import { mondayFirstDayLetters } from "@nag/core";

const CHECKED_IN_COLOR = "#34C759";
const CIRCLE_SIZE = 24;

interface DayIndicatorsProps {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
}

export const DayIndicators = ({
  scheduledDaysMask,
  checkedInDaysMask,
}: DayIndicatorsProps) => (
  <View style={styles.row}>
    {mondayFirstDayLetters.map(({ day, letter }, i) => {
      const scheduled = (scheduledDaysMask & day) !== 0;
      const checkedIn = scheduled && (checkedInDaysMask & day) !== 0;
      return (
        <View key={i} style={styles.cell}>
          <View style={[styles.circle, checkedIn && styles.checkedIn]}>
            <Text
              style={[styles.letter, !scheduled && styles.unscheduledLetter]}
            >
              {letter}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
);

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
  checkedIn: {
    backgroundColor: CHECKED_IN_COLOR,
  },
  letter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  unscheduledLetter: {
    opacity: 0.35,
  },
});
