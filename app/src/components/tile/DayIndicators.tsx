import { StyleSheet, Text, View } from "react-native";
import { mondayFirstDayLetters } from "@nag/core";

interface DayIndicatorsProps {
  scheduledDaysMask: number;
  scheduledDayColor: string;
}

export const DayIndicators = ({
  scheduledDaysMask,
  scheduledDayColor,
}: DayIndicatorsProps) => (
  <View style={styles.row}>
    {mondayFirstDayLetters.map(({ day, letter }, i) => {
      const scheduled = (scheduledDaysMask & day) !== 0;
      return (
        <View
          key={i}
          style={[
            styles.indicator,
            {
              backgroundColor: scheduled
                ? scheduledDayColor
                : "rgba(255, 255, 255, 0.2)",
            },
          ]}
        >
          <Text style={[styles.letter, { opacity: scheduled ? 1 : 0.5 }]}>
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
    justifyContent: "space-around",
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
  letter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
});
