import { Pressable, StyleSheet, Text, View } from "react-native";
import { startOfWeek, addDays, startOfDay, isAfter } from "date-fns";
import {
  buildDayCells,
  dayTitles,
  isSameCalendarDay,
  mondayFirstDayLetters,
} from "@nag/core";
import { complianceColors } from "../getComplianceColor";

interface WeekStripProps {
  scheduledDaysMask: number;
  /** Days where every scheduled slot has a check-in (full completion). */
  checkedInDaysMask: number;
  /** Days where some — but not all — scheduled slots have a check-in. */
  partialDaysMask?: number;
  /**
   * Days with at least one check-in regardless of schedule. Used to show
   * a dimmed green fill on unscheduled days the user still checked in on.
   */
  anyCheckInDaysMask?: number;
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
  anyCheckInDaysMask,
  todayColor,
  now = new Date(),
  selectedDay,
  onSelectDay,
}: WeekStripProps) => {
  const cells = buildDayCells({
    scheduledDaysMask,
    checkedInDaysMask,
    partialDaysMask,
    anyCheckInDaysMask,
    checkedInColor: complianceColors.compliant,
    partialColor: complianceColors.partial,
    todayColor,
    missedColor: complianceColors.failing,
    now,
  });

  const mondayThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const todayStart = startOfDay(now);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>This week</Text>
      <View style={styles.row}>
        {cells.map(({ letter, scheduled, backgroundColor }, i) => {
          const cellDate = addDays(mondayThisWeek, i);
          const isSelected =
            selectedDay !== null && isSameCalendarDay(cellDate, selectedDay);
          // Future days can't be navigated to — you can't check in (or skip)
          // something that hasn't happened yet. Disable the press and mute
          // the cell visually so the affordance is obvious.
          const isFuture = isAfter(cellDate, todayStart);
          const dayBit = mondayFirstDayLetters[i].day;
          // Unscheduled day with a check-in: dim the whole circle to match
          // the faded letter, so the extra check-in reads as "bonus" not
          // required.
          const unscheduledFilled = !scheduled && backgroundColor !== undefined;
          return (
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() =>
                isFuture ? undefined : onSelectDay(isSelected ? null : cellDate)
              }
              disabled={isFuture}
              accessibilityRole="button"
              accessibilityLabel={`Select ${dayTitles[dayBit]}`}
              accessibilityState={{ selected: isSelected, disabled: isFuture }}
            >
              <View
                style={[
                  styles.circle,
                  backgroundColor ? { backgroundColor } : styles.circleUnfilled,
                  isSelected && styles.circleSelected,
                  isFuture && styles.circleFuture,
                  unscheduledFilled && styles.circleUnscheduledFilled,
                ]}
              >
                <Text
                  style={[
                    styles.letter,
                    !backgroundColor && styles.letterUnfilled,
                    !scheduled &&
                      !unscheduledFilled &&
                      styles.letterUnscheduled,
                    isFuture && styles.letterFuture,
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
  circleFuture: {
    opacity: 0.4,
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
  circleUnscheduledFilled: {
    opacity: 0.4,
  },
  letterFuture: {
    color: "#bbb",
  },
});
