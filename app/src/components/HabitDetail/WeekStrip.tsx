import { Pressable, StyleSheet, Text, View } from "react-native";
import { startOfWeek, addDays } from "date-fns";
import { buildDayCells, mondayFirstDayLetters } from "@nag/core";
import { complianceColors } from "../getComplianceColor";

interface WeekStripProps {
  scheduledDaysMask: number;
  /** Days where every scheduled slot has a check-in (full completion). */
  checkedInDaysMask: number;
  /** Days where some — but not all — scheduled slots have a check-in. */
  partialDaysMask?: number;
  /** Override for today's circle (partial/failing/compliant). */
  todayColor?: string;
  /** Anchor day for the week (today by default). */
  now?: Date;
  /** The currently selected day (for highlighting), or null if none. */
  selectedDay: Date | null;
  /**
   * Called when the user taps a day cell. Passes the tapped day's Date, or
   * null when the tap clears an existing selection.
   */
  onSelectDay: (day: Date | null) => void;
}

const CIRCLE_SIZE = 36;

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Full-width weekly strip showing scheduled vs. checked-in days, with
 * today highlighted by the passed compliance color. Each day cell is
 * pressable — tapping updates the selected day (or clears it if already
 * selected). Unlike `tile/DayIndicators` this is a normal-flow block
 * (not absolutely positioned) and uses larger circles suited to the
 * detail screen.
 */
export const WeekStrip = ({
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask,
  todayColor,
  now = new Date(),
  selectedDay,
  onSelectDay,
}: WeekStripProps) => {
  const cells = buildDayCells({
    scheduledDaysMask,
    checkedInDaysMask,
    partialDaysMask,
    checkedInColor: complianceColors.compliant,
    partialColor: complianceColors.partial,
    todayColor,
    missedColor: complianceColors.failing,
    now,
  });

  const mondayThisWeek = startOfWeek(now, { weekStartsOn: 1 });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>This week</Text>
      <View style={styles.row}>
        {cells.map(({ letter, scheduled, backgroundColor }, i) => {
          const cellDate = addDays(mondayThisWeek, i);
          const isSelected =
            selectedDay !== null && isSameCalendarDay(cellDate, selectedDay);
          const dayBit = mondayFirstDayLetters[i].day;
          return (
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() => onSelectDay(isSelected ? null : cellDate)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${WEEKDAY_FULL[dayBit]}`}
              accessibilityState={{ selected: isSelected }}
            >
              <View
                style={[
                  styles.circle,
                  backgroundColor ? { backgroundColor } : styles.circleUnfilled,
                  isSelected && styles.circleSelected,
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// Day-bit to full weekday name, used purely for accessibility labels.
const WEEKDAY_FULL: Record<number, string> = {
  1: "Sunday",
  2: "Monday",
  4: "Tuesday",
  8: "Wednesday",
  16: "Thursday",
  32: "Friday",
  64: "Saturday",
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
  circleSelected: {
    borderWidth: 2,
    borderColor: "#222",
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
