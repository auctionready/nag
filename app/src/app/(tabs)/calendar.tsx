import { useState, useMemo, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isSameDay,
  isSameMonth,
  isAfter,
  addMonths,
  subMonths,
  startOfDay,
} from "date-fns";
import {
  useCalendarCheckIns,
  useSelectedDayCheckIns,
} from "../../components/useCalendarCheckIns";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarScreen() {
  const today = startOfDay(new Date());
  const currentMonthStart = startOfMonth(today);

  const [currentMonth, setCurrentMonth] = useState(() => currentMonthStart);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const isCurrentMonth = isSameMonth(currentMonth, today);

  const { allCheckIns, checkInsByDate } = useCalendarCheckIns();
  const selectedDayCheckIns = useSelectedDayCheckIns(selectedDay, allCheckIns);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  // Monday = 0 offset. getDay returns 0 for Sunday, so shift.
  const firstDayOffset = (getDay(days[0]) + 6) % 7;

  const changeMonth = useCallback(
    (dir: 1 | -1) => {
      const next =
        dir === 1 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1);
      if (isAfter(startOfMonth(next), currentMonthStart)) return;
      setCurrentMonth(next);
      if (selectedDay && !isSameMonth(selectedDay, next)) {
        setSelectedDay(null);
      }
    },
    [currentMonth, selectedDay, currentMonthStart],
  );

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.header}>
        <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
          <Text style={styles.navButtonText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {format(currentMonth, "MMMM yyyy")}
        </Text>
        <Pressable
          onPress={() => changeMonth(1)}
          style={styles.navButton}
          disabled={isCurrentMonth}
        >
          <Text
            style={[
              styles.navButtonText,
              isCurrentMonth && styles.navButtonDisabled,
            ]}
          >
            {">"}
          </Text>
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {/* Empty cells for offset */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}
        {days.map((day) => {
          const key = startOfDay(day).toISOString();
          const dayCheckIns = checkInsByDate.get(key);
          const hasCheckIns = dayCheckIns && dayCheckIns.length > 0;
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = isSameDay(day, today);
          const isFuture = isAfter(day, today);

          return (
            <Pressable
              key={key}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => !isFuture && setSelectedDay(day)}
              disabled={isFuture}
            >
              <Text
                style={[
                  styles.dayText,
                  isToday && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                  isFuture && styles.dayTextFuture,
                ]}
              >
                {format(day, "d")}
              </Text>
              {hasCheckIns && (
                <View style={styles.dotRow}>
                  <View style={styles.dot} />
                  {dayCheckIns.length > 1 && <View style={styles.dot} />}
                  {dayCheckIns.length > 2 && <View style={styles.dot} />}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Selected day detail */}
      {selectedDay && (
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>
            {format(selectedDay, "EEEE, MMMM d")}
          </Text>
          {selectedDayCheckIns.length === 0 ? (
            <Text style={styles.emptyDetail}>No check-ins this day</Text>
          ) : (
            <ScrollView style={styles.detailScroll}>
              {selectedDayCheckIns.map((ci) => (
                <View key={ci.id} style={styles.detailRow}>
                  <View style={styles.detailDot} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailHabit}>{ci.habitTitle}</Text>
                    <Text style={styles.detailTime}>
                      {format(ci.timestamp, "h:mm a")}
                      {ci.skipped ? " (skipped)" : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navButton: {
    padding: 12,
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#007AFF",
  },
  navButtonDisabled: {
    color: "#ccc",
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  dayCellSelected: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  dayText: {
    fontSize: 15,
    color: "#333",
  },
  dayTextToday: {
    fontWeight: "700",
    color: "#007AFF",
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayTextFuture: {
    color: "#ccc",
  },
  dotRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#34C759",
  },
  detailSection: {
    flex: 1,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  emptyDetail: {
    fontSize: 14,
    color: "#999",
  },
  detailScroll: {
    flex: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailHabit: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  detailTime: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});
