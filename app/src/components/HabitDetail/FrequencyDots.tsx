import { StyleSheet, View } from "react-native";
import { complianceColors } from "../getComplianceColor";

interface FrequencyDotsProps {
  frequency: number;
  completed: number;
}

const DOT_SIZE = 14;

/**
 * Row of dots for frequency-only habits (no timed schedule): N dots
 * total, filled up to `completed` in green, remainder as outline.
 */
export const FrequencyDots = ({ frequency, completed }: FrequencyDotsProps) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: frequency }).map((_, i) => {
        const filled = i < completed;
        return (
          <View
            key={i}
            style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
  },
  dotFilled: {
    backgroundColor: complianceColors.compliant,
    borderColor: complianceColors.compliant,
  },
  dotEmpty: {
    backgroundColor: "#fff",
    borderColor: "#d0d0d0",
  },
});
