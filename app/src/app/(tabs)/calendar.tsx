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
  // Week view may have nothing selected (showing the empty bottom),
  // a habit only (week summary for that habit), a day only (day list),
  // or both (single-habit slot detail for that day). Month view always
  // has a day selected.
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
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

  // Month view: tap a day to select; tapping the selected day is a no-op.
  // Week view: tap a day to select; tap it again to clear (the bottom
  // panel then collapses to the empty / habit-only state).
  const handleSelectDay = useCallback(
    (day: Date) => {
      if (isAfter(day, today)) return;
      const next = startOfDay(day);
      setSelectedDay((prev) => {
        if (view === "week" && prev && isSameDay(prev, next)) return null;
        return next;
      });
    },
    [today, view],
  );

  const handleViewChange = useCallback(
    (next: CalendarView) => {
      setView(next);
      // Anchor the new window on the currently-selected day so the user
      // doesn't lose their place. If nothing is selected (week view's
      // empty state), fall back to today.
      const anchor = selectedDay ?? today;
      if (next === "month") {
        setMonthDate(startOfMonth(anchor));
        // Month view always shows a day's check-ins.
        if (!selectedDay) setSelectedDay(today);
        setSelectedHabitId(null);
      } else {
        setWeekStart(startOfWeek(anchor, { weekStartsOn: 1 }));
      }
    },
    [selectedDay, today],
  );

  // Labels for the nav row. The "today" pill is disabled only when
  // tapping it would do nothing — i.e. the visible window already
  // covers today AND the selected day is today.
  const navState = useMemo(() => {
    const selectedIsToday =
      selectedDay !== null && isSameDay(selectedDay, today);
    if (view === "month") {
      const onCurrentWindow = isSameMonth(monthDate, today);
      return {
        prev: format(subMonths(monthDate, 1), "MMM"),
        next: format(addMonths(monthDate, 1), "MMM"),
        nextDisabled: onCurrentWindow,
        todayDisabled: onCurrentWindow && selectedIsToday,
      };
    }
    const prevStart = subDays(weekStart, 7);
    const prevEnd = endOfWeek(prevStart, { weekStartsOn: 1 });
    const nextStart = addDays(weekStart, 7);
    const nextEnd = endOfWeek(nextStart, { weekStartsOn: 1 });
    const onCurrentWindow = isSameDay(weekStart, todayWeekStart);
    return {
      prev: formatRange(prevStart, prevEnd),
      next: formatRange(nextStart, nextEnd),
      nextDisabled: onCurrentWindow,
      todayDisabled: onCurrentWindow && selectedIsToday,
    };
  }, [view, monthDate, weekStart, today, todayWeekStart, selectedDay]);

  const weekRowsData = useMemo(
    () => weekRows(weekStart),
    [weekRows, weekStart],
  );
  const groupsForSelectedDay = useMemo(
    () => (selectedDay ? dayGroups(selectedDay) : []),
    [dayGroups, selectedDay],
  );

  const weekRowForFilter = useMemo(
    () =>
      selectedHabitId
        ? (weekRowsData.find((r) => r.habit.id === selectedHabitId) ?? null)
        : null,
    [weekRowsData, selectedHabitId],
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
        prevLabel={navState.prev}
        nextLabel={navState.next}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        nextDisabled={navState.nextDisabled}
        todayDisabled={navState.todayDisabled}
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

      {/* Bottom panel — empty / habit-only / day-only / day + habit. */}
      <SelectedDayCheckIns
        day={selectedDay}
        today={today}
        weekStart={weekStart}
        groups={groupsForSelectedDay}
        filteredHabit={view === "week" ? filteredHabit : null}
        weekRowForFilter={view === "week" ? weekRowForFilter : null}
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
