import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tokens } from "../theme";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface MonthViewProps {
  monthDate: Date;
  today: Date;
  selectedDay: Date | null;
  /** For each day, the count of completed (non-skip) check-ins. Drives heat. */
  heatFor: (day: Date) => { total: number; done: number; skips: number };
  onSelectDay: (day: Date) => void;
}

/**
 * Six-row month grid. Each in-month cell is a rounded swatch tinted with
 * ink alpha proportional to that day's completed-check-in ratio (capped
 * at a soft maximum). Today gets a 1.5px orange ring with the date in
 * orange — the cue sits *on top of* whatever heat is underneath so the
 * day's progress remains legible. Selected day (when not today) gets a
 * 1.5px ink ring. Future days are visually lighter but tappable.
 */
export const MonthView = ({
  monthDate,
  today,
  selectedDay,
  heatFor,
  onSelectDay,
}: MonthViewProps) => {
  const days = useMemo(() => {
    // 6 rows × 7 cols, padded with neighbouring-month days so the grid
    // is always rectangular (matching the design).
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthDate]);

  // Light heat ramp — capped so a single 8-slot daily habit doesn't make
  // every other day look pale by comparison. We cap at a sensible value.
  const ramp = useMemo(() => {
    let max = 0;
    for (const day of days) {
      const { done } = heatFor(day);
      if (done > max) max = done;
    }
    return Math.max(3, max);
  }, [days, heatFor]);

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LETTERS.map((d, i) => (
          <View key={i} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isFuture = isAfter(day, today);
          const { done } = heatFor(day);

          // Heat: 0 → empty, 1+ → ramp 0.18 → 0.78. Today keeps its
          // heat fill; the orange today-ring sits on top of the swatch.
          const heatRatio =
            done === 0 ? 0 : 0.18 + 0.6 * Math.min(1, done / ramp);
          const heatBg =
            done > 0 ? `rgba(26,20,16,${heatRatio.toFixed(3)})` : "transparent";
          const useCreamText = done > 0 && heatRatio > 0.5 && !isToday;

          // Selected day swaps the heat fill for cream and gets a 1.5px
          // ink ring. Today's orange ring is suppressed when both are
          // true (ink ring wins) but today's orange date text remains —
          // so a selected-today day still reads as "today".
          const cellBg = isSelected ? tokens.surface : heatBg;
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => onSelectDay(day)}
              style={[styles.cell, isSelected && styles.cellLifted]}
              disabled={!inMonth}
            >
              <View
                style={[
                  styles.inner,
                  { backgroundColor: cellBg },
                  !inMonth && styles.innerOutMonth,
                  isToday && !isSelected && styles.innerToday,
                  isSelected && styles.innerSelected,
                  inMonth &&
                    done === 0 &&
                    !isToday &&
                    !isSelected &&
                    styles.innerEmpty,
                  !inMonth && styles.innerOutMonthBorder,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                    isToday && styles.dayTextToday,
                    useCreamText && !isSelected && styles.dayTextOnHeat,
                    !inMonth && styles.dayTextOutMonth,
                    isFuture && inMonth && !isToday && styles.dayTextFuture,
                    (isSelected || isToday) && styles.dayTextBold,
                  ]}
                >
                  {day.getDate()}
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
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekdayText: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  cellLifted: {
    zIndex: 2,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  inner: {
    flex: 1,
    borderRadius: 8,
    padding: 5,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  innerOutMonth: {
    opacity: 0.35,
  },
  innerOutMonthBorder: {
    borderWidth: 1,
    borderColor: tokens.faint,
    borderStyle: "dashed",
  },
  innerEmpty: {
    borderWidth: 1,
    borderColor: tokens.faint,
  },
  innerSelected: {
    borderWidth: 1.5,
    borderColor: tokens.ink,
  },
  innerToday: {
    borderWidth: 1.5,
    borderColor: tokens.orange,
  },
  dayText: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.ink,
    fontWeight: "500",
  },
  dayTextToday: {
    color: tokens.orange,
  },
  dayTextOnHeat: {
    color: tokens.cream,
  },
  dayTextSelected: {
    color: tokens.ink,
  },
  dayTextBold: {
    fontWeight: "700",
  },
  dayTextOutMonth: {
    color: tokens.mute,
  },
  dayTextFuture: {
    color: tokens.mute,
  },
});
