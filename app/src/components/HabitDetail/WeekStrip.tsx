import { StyleSheet, Text, View } from "react-native";
import { buildDayCells } from "@nag/core";
import { complianceColors } from "../getComplianceColor";

interface WeekStripProps {
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  /** Override for today's circle (partial/failing/compliant). */
  todayColor?: string;
}

const CIRCLE_SIZE = 36;

/**
 * Full-width weekly strip showing scheduled vs. checked-in days, with
 * today highlighted by the passed compliance color. Unlike
 * `tile/DayIndicators` this is a normal-flow block (not absolutely
 * positioned) and uses larger circles suited to the detail screen.
 */
export const WeekStrip = ({
  scheduledDaysMask,
  checkedInDaysMask,
  todayColor,
}: WeekStripProps) => {
  const cells = buildDayCells({
    scheduledDaysMask,
    checkedInDaysMask,
    checkedInColor: complianceColors.compliant,
    todayColor,
    missedColor: complianceColors.failing,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>This week</Text>
      <View style={styles.row}>
        {cells.map(({ letter, scheduled, backgroundColor }, i) => (
          <View key={i} style={styles.cell}>
            <View
              style={[
                styles.circle,
                backgroundColor ? { backgroundColor } : styles.circleUnfilled,
              ]}
            >
              <Text
                style={[
                  styles.letter,
                  !backgroundColor && styles.letterUnfilled,
                  !scheduled && styles.letterUnscheduled,
                ]}
              >
                {letter}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
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
  circleUnfilled: {
    backgroundColor: "#f2f2f4",
  },
  letter: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  letterUnfilled: {
    color: "#888",
  },
  letterUnscheduled: {
    opacity: 0.4,
  },
});
