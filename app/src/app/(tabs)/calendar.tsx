import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import {
  CalNavRow,
  MonthView,
  SelectedDayCheckIns,
  ViewToggle,
  WeekView,
  useCalendarData,
  type CalendarView,
} from "../../components/calendar";
import { tokens } from "../../components/theme";

const formatRange = (start: Date, end: Date) => {
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")}–${format(end, "d")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
};

const weekTitle = (weekStart: Date, todayWeekStart: Date): string => {
  const offset = differenceInCalendarWeeks(weekStart, todayWeekStart, {
    weekStartsOn: 1,
  });
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  return `Week of ${format(weekStart, "MMM d")}`;
};

const monthTitle = (monthDate: Date, todayMonthStart: Date): string => {
  const offset = differenceInCalendarMonths(monthDate, todayMonthStart);
  if (offset === 0) return "This month";
  if (offset === -1) return "Last month";
  if (offset === 1) return "Next month";
  return format(monthDate, "MMMM yyyy");
};

const CalendarScreen = () => {
  const { today, weekRows, dayGroups, monthHeat, habits } = useCalendarData();

  const todayMonthStart = useMemo(() => startOfMonth(today), [today]);
  const todayWeekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );

  const [view, setView] = useState<CalendarView>("month");
  const [monthDate, setMonthDate] = useState<Date>(todayMonthStart);
  const [weekStart, setWeekStart] = useState<Date>(todayWeekStart);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Navigation
  const goPrev = useCallback(() => {
    if (view === "month") {
      setMonthDate((m) => subMonths(m, 1));
    } else {
      setWeekStart((w) => subDays(w, 7));
    }
  }, [view]);

  const goNext = useCallback(() => {
    if (view === "month") {
      setMonthDate((m) => {
        const next = addMonths(m, 1);
        return isAfter(startOfMonth(next), todayMonthStart) ? m : next;
      });
    } else {
      setWeekStart((w) => {
        const next = addDays(w, 7);
        return isAfter(next, todayWeekStart) ? w : next;
      });
    }
  }, [view, todayMonthStart, todayWeekStart]);

  const goToday = useCallback(() => {
    if (view === "month") setMonthDate(todayMonthStart);
    else setWeekStart(todayWeekStart);
    setSelectedDay(today);
  }, [view, todayMonthStart, todayWeekStart, today]);

  const handleSelectDay = useCallback(
    (day: Date) => {
      if (isAfter(day, today)) return;
      setSelectedDay(startOfDay(day));
    },
    [today],
  );

  const handleViewChange = useCallback(
    (next: CalendarView) => {
      setView(next);
      // When switching views, anchor the new window on the currently
      // selected day so the user doesn't lose their place.
      if (next === "month") {
        setMonthDate(startOfMonth(selectedDay));
      } else {
        setWeekStart(startOfWeek(selectedDay, { weekStartsOn: 1 }));
      }
      // Habit filter only makes sense on the week view.
      if (next === "month") setSelectedHabitId(null);
    },
    [selectedDay],
  );

  // Labels and current/next-window state for the nav row
  const navState = useMemo(() => {
    if (view === "month") {
      const onCurrent = isSameMonth(monthDate, today);
      return {
        prev: format(subMonths(monthDate, 1), "MMM"),
        next: format(addMonths(monthDate, 1), "MMM"),
        nextDisabled: onCurrent,
        onCurrent,
        todayLabel: "today",
      };
    }
    const prevStart = subDays(weekStart, 7);
    const prevEnd = endOfWeek(prevStart, { weekStartsOn: 1 });
    const nextStart = addDays(weekStart, 7);
    const nextEnd = endOfWeek(nextStart, { weekStartsOn: 1 });
    const onCurrent = isSameDay(weekStart, todayWeekStart);
    return {
      prev: formatRange(prevStart, prevEnd),
      next: formatRange(nextStart, nextEnd),
      nextDisabled: onCurrent,
      onCurrent,
      todayLabel: "this week",
    };
  }, [view, monthDate, weekStart, today, todayWeekStart]);

  const weekRowsData = useMemo(
    () => weekRows(weekStart),
    [weekRows, weekStart],
  );
  const groupsForSelectedDay = useMemo(
    () => dayGroups(selectedDay),
    [dayGroups, selectedDay],
  );

  const filteredHabit = useMemo(() => {
    if (!selectedHabitId) return null;
    return habits.find((h) => h.id === selectedHabitId) ?? null;
  }, [habits, selectedHabitId]);

  const monthSummary = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    let total = 0;
    let done = 0;
    for (let day = monthStart; !isAfter(day, monthEnd); day = addDays(day, 1)) {
      const { total: t, done: d } = monthHeat(day);
      total += t;
      done += d;
    }
    return { total, done };
  }, [monthDate, monthHeat]);

  const weekSummary = useMemo(() => {
    let total = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const { total: t, done: d } = monthHeat(addDays(weekStart, i));
      total += t;
      done += d;
    }
    return { total, done };
  }, [weekStart, monthHeat]);

  const headerTitle =
    view === "month"
      ? monthTitle(monthDate, todayMonthStart)
      : weekTitle(weekStart, todayWeekStart);

  const headerSummary =
    view === "month"
      ? monthSummary.total > 0
        ? `${Math.round((monthSummary.done / monthSummary.total) * 100)}% compliance · ${monthSummary.done} of ${monthSummary.total}`
        : "No check-ins this month"
      : weekSummary.total > 0
        ? `${Math.round((weekSummary.done / weekSummary.total) * 100)}% compliance · ${weekSummary.done} of ${weekSummary.total}`
        : "No check-ins this week";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerCol}>
          <Text style={styles.heading} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.subhead}>{headerSummary}</Text>
        </View>
        <ViewToggle view={view} onChange={handleViewChange} />
      </View>

      {/* Prev / today / next */}
      <CalNavRow
        todayLabel={navState.todayLabel}
        prevLabel={navState.prev}
        nextLabel={navState.next}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        nextDisabled={navState.nextDisabled}
        onCurrent={navState.onCurrent}
      />

      {/* Grid */}
      {view === "month" ? (
        <MonthView
          monthDate={monthDate}
          today={today}
          selectedDay={selectedDay}
          heatFor={monthHeat}
          onSelectDay={handleSelectDay}
        />
      ) : (
        <WeekView
          weekStart={weekStart}
          today={today}
          selectedDay={selectedDay}
          selectedHabitId={selectedHabitId}
          rows={weekRowsData}
          onSelectDay={handleSelectDay}
          onSelectHabit={setSelectedHabitId}
        />
      )}

      {/* Selected day check-ins (or filtered habit detail) */}
      <SelectedDayCheckIns
        day={selectedDay}
        today={today}
        groups={groupsForSelectedDay}
        filteredHabit={view === "week" ? filteredHabit : null}
        onClearFilter={() => setSelectedHabitId(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCol: {
    flex: 1,
    gap: 3,
  },
  heading: {
    fontSize: 26,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  subhead: {
    marginTop: 1,
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
    letterSpacing: 0.3,
  },
});

export default CalendarScreen;
