import { StyleSheet, Text, View } from "react-native";
import { mondayFirstDayLetters } from "@nag/core";

const CHECKED_IN_COLOR = "#34C759";

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
        <View
          key={i}
          style={[styles.indicator, checkedIn && styles.checkedInIndicator]}
        >
          <Text style={[styles.letter, !scheduled && styles.unscheduledLetter]}>
            {letter}
          </Text>
        </View>
      );
    })}
  </View>
);

const INDICATOR_SIZE = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignSelf: "stretch",
    marginTop: 10,
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkedInIndicator: {
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
