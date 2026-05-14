import { Pressable, StyleSheet, Text, View } from "react-native";
import { addDays, isSameDay } from "date-fns";
import { tokens } from "../theme";
import { CellGlyph } from "../habit-detail/CellGlyph";
import type { WeekRow } from "./useCalendarData";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

interface WeekViewProps {
  weekStart: Date;
  today: Date;
  selectedDay: Date | null;
  selectedHabitId: string | null;
  rows: WeekRow[];
  onSelectDay: (day: Date) => void;
  onSelectHabit: (habitId: string | null) => void;
}

/**
 * Habit × day grid. Each row is a habit; each column is one day of the
 * current week (Mon-Sun). Day cells render the same `CellGlyph` language
 * used elsewhere (done · today · partial · missed · skipped · future ·
 * unscheduled). Tapping a column header selects that day; tapping a
 * habit row filters the bottom section to that habit.
 */
export const WeekView = ({
  weekStart,
  today,
  selectedDay,
  selectedHabitId,
  rows,
  onSelectDay,
  onSelectHabit,
}: WeekViewProps) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLabelCell}>
            <Text style={styles.headerLabelText}>habit</Text>
          </View>
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            const isSel = selectedDay && isSameDay(day, selectedDay);
            return (
              <Pressable
                key={i}
                onPress={() => onSelectDay(day)}
                style={[
                  styles.headerDayCell,
                  isSel && styles.headerDayCellSelected,
                ]}
              >
                <Text
                  style={[styles.headerDow, isToday && styles.headerDowToday]}
                >
                  {DAY_LETTERS[i]}
                </Text>
                <Text
                  style={[styles.headerDate, isToday && styles.headerDateToday]}
                >
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Habit rows */}
        {rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No habits to show this week.</Text>
          </View>
        ) : (
          rows.map((row, ri) => {
            const isSelHabit = selectedHabitId === row.habit.id;
            return (
              <Pressable
                key={row.habit.id}
                onPress={() => onSelectHabit(isSelHabit ? null : row.habit.id)}
                style={[
                  styles.habitRow,
                  ri > 0 && styles.habitRowDivider,
                  isSelHabit && styles.habitRowSelected,
                ]}
              >
                <View style={styles.habitLabelCell}>
                  {isSelHabit && <View style={styles.habitRowStripe} />}
                  <Text
                    style={[
                      styles.habitTitle,
                      isSelHabit && styles.habitTitleSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {row.habit.title}
                  </Text>
                </View>
                {row.states.map((state, di) => (
                  <View key={di} style={styles.dayCell}>
                    <CellGlyph state={state} />
                  </View>
                ))}
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.hintRow}>
        <Text style={styles.hint}>tap a habit to filter below</Text>
        <Text style={styles.hint}>tap a day to scope</Text>
      </View>
    </View>
  );
};

const HEADER_DOW_HEIGHT = 32;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  headerLabelCell: {
    width: 70,
    paddingLeft: 8,
  },
  headerLabelText: {
    fontFamily: "JetBrainsMono",
    fontSize: 8.5,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  headerDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    marginHorizontal: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
    minHeight: HEADER_DOW_HEIGHT,
  },
  headerDayCellSelected: {
    borderColor: tokens.ink,
  },
  headerDow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    fontWeight: "700",
    color: tokens.mute,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerDowToday: {
    color: tokens.orange,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.3,
    lineHeight: 16,
    marginTop: 1,
  },
  headerDateToday: {
    color: tokens.orange,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    position: "relative",
  },
  habitRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.veryFaint,
  },
  habitRowSelected: {
    backgroundColor: tokens.inkTint,
  },
  habitRowStripe: {
    position: "absolute",
    left: 0,
    top: 2,
    bottom: 2,
    width: 3,
    backgroundColor: tokens.orange,
    borderRadius: 2,
  },
  habitLabelCell: {
    width: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    position: "relative",
  },
  habitTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
  habitTitleSelected: {
    fontWeight: "700",
    color: tokens.orange,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 1,
    marginHorizontal: 1,
    borderRadius: 6,
  },
  emptyRow: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
  },
  hintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  hint: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
