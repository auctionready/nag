import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  addDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  canStepForward,
  clampDayToToday,
  stepCalendarDay,
  type CalendarView,
} from "@nag/core";
import { seqUuid } from "@nag/schema";
import {
  CalNavRow,
  CalendarViewNav,
  DayView,
  MonthView,
  SelectedDayCheckIns,
  WeekView,
  useCalendarData,
  type DayAgendaItem,
} from "../components/calendar";
import { dispatch } from "../infrastructure/dispatch";
import { tokens } from "../components/theme";

const DAY_PARAM_FORMAT = "yyyy-MM-dd";
const fmt = (day: Date) => format(day, DAY_PARAM_FORMAT);

// Horizontal travel / fling speed past which a swipe steps a period.
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 400;

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

const dayTitle = (day: Date, today: Date): string => {
  if (isSameDay(day, today)) return "Today";
  if (isSameDay(day, addDays(today, 1))) return "Tomorrow";
  if (isSameDay(day, addDays(today, -1))) return "Yesterday";
  return format(day, "EEEE");
};

const dayShort = (day: Date): string => format(day, "EEE d MMM");

const daySummary = (agenda: {
  items: { status: DayAgendaItem["status"] }[];
  mode: string;
}): string => {
  const count = (s: DayAgendaItem["status"]) =>
    agenda.items.filter((i) => i.status === s).length;
  if (agenda.mode === "future") {
    const total =
      count("scheduled") + count("done") + count("skip") + count("missed");
    return total === 0 ? "nothing scheduled" : `${total} scheduled`;
  }
  if (agenda.mode === "past") {
    const done = count("done");
    const missed = count("missed");
    const skip = count("skip");
    if (done + missed + skip === 0) return "no record";
    return missed > 0
      ? `${done} done · ${missed} missed · ${skip} skipped`
      : `${done} done · all on track`;
  }
  const overdue = count("overdue");
  const upcoming = count("upcoming");
  const done = count("done");
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (upcoming > 0) parts.push(`${upcoming} upcoming`);
  parts.push(`${done} logged`);
  return parts.join(" · ");
};

interface CalendarScreenProps {
  view: CalendarView;
  /** Raw `yyyy-MM-dd` from the route (undefined when not set). */
  day: string | undefined;
  onChangeView: (view: CalendarView) => void;
  onChangeDay: (day: string) => void;
}

export const CalendarScreen = ({
  view,
  day: dayParam,
  onChangeView,
  onChangeDay,
}: CalendarScreenProps) => {
  const { today, weekRows, dayGroups, dayAgenda, monthHeat, habits } =
    useCalendarData();

  const todayMonthStart = useMemo(() => startOfMonth(today), [today]);
  const todayWeekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );

  // The whole screen is derived from two route params: `view` (month/week/day)
  // and `day` (yyyy-MM-dd). `day` doubles as both the visible window's
  // anchor and the selected day, so swiping/navigating never grows the
  // history stack — the back button always returns straight to the board.
  // Month/week clamp future days back to today (those windows can't show
  // anything beyond now); day view allows future days so users can preview
  // tomorrow's scheduled list per the design.
  const baseDay = useMemo(() => {
    const parsed = dayParam ? parseISO(dayParam) : null;
    const valid = parsed && !Number.isNaN(parsed.getTime()) ? parsed : today;
    return view === "day" ? valid : clampDayToToday(valid, today);
  }, [dayParam, today, view]);

  const monthDate = useMemo(() => startOfMonth(baseDay), [baseDay]);
  const weekStart = useMemo(
    () => startOfWeek(baseDay, { weekStartsOn: 1 }),
    [baseDay],
  );
  const selectedDay = baseDay;

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  // Navigation — each handler rewrites the `day`/`view` route params via
  // the callbacks the route owns.
  const goPrev = useCallback(() => {
    onChangeDay(
      fmt(stepCalendarDay({ day: baseDay, view, direction: "prev" })),
    );
  }, [onChangeDay, baseDay, view]);

  const goNext = useCallback(() => {
    if (!canStepForward(baseDay, view, today)) return;
    const next = stepCalendarDay({ day: baseDay, view, direction: "next" });
    onChangeDay(fmt(view === "day" ? next : clampDayToToday(next, today)));
  }, [onChangeDay, baseDay, view, today]);

  const goToday = useCallback(() => {
    onChangeDay(fmt(today));
  }, [onChangeDay, today]);

  const handleSelectDay = useCallback(
    (day: Date) => {
      if (isAfter(day, today)) return;
      onChangeDay(fmt(day));
    },
    [onChangeDay, today],
  );

  // Contextual horizontal swipe over the calendar, matching stock calendar
  // apps: swipe left → forward in time, swipe right → back. `activeOffsetX`
  // + `failOffsetY` keep vertical scrolling of the bottom panel intact, and
  // `runOnJS` lets the handler call `router.setParams` directly.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .runOnJS(true)
        .onEnd((e) => {
          if (
            e.translationX < -SWIPE_THRESHOLD ||
            e.velocityX < -SWIPE_VELOCITY
          ) {
            goNext();
          } else if (
            e.translationX > SWIPE_THRESHOLD ||
            e.velocityX > SWIPE_VELOCITY
          ) {
            goPrev();
          }
        }),
    [goNext, goPrev],
  );

  // Labels for the nav row. "next" is disabled once the visible window
  // already reaches today's period; "today" once the selected day is today.
  const navState = useMemo(() => {
    const prevDay = stepCalendarDay({ day: baseDay, view, direction: "prev" });
    const nextDay = stepCalendarDay({ day: baseDay, view, direction: "next" });
    const nextDisabled = !canStepForward(baseDay, view, today);
    const todayDisabled = isSameDay(baseDay, today);
    if (view === "day") {
      return {
        prev: dayShort(prevDay),
        next: dayShort(nextDay),
        nextDisabled,
        todayDisabled,
      };
    }
    if (view === "month") {
      return {
        prev: format(prevDay, "MMM"),
        next: format(nextDay, "MMM"),
        nextDisabled,
        todayDisabled,
      };
    }
    return {
      prev: formatRange(
        startOfWeek(prevDay, { weekStartsOn: 1 }),
        endOfWeek(prevDay, { weekStartsOn: 1 }),
      ),
      next: formatRange(
        startOfWeek(nextDay, { weekStartsOn: 1 }),
        endOfWeek(nextDay, { weekStartsOn: 1 }),
      ),
      nextDisabled,
      todayDisabled,
    };
  }, [view, baseDay, today]);

  const weekRowsData = useMemo(
    () => weekRows(weekStart),
    [weekRows, weekStart],
  );
  const groupsForSelectedDay = useMemo(
    () => dayGroups(selectedDay),
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

  const agendaForDay = useMemo(
    () => (view === "day" ? dayAgenda(baseDay) : null),
    [view, dayAgenda, baseDay],
  );

  const headerTitle =
    view === "day"
      ? dayTitle(baseDay, today)
      : view === "month"
        ? monthTitle(monthDate, todayMonthStart)
        : weekTitle(weekStart, todayWeekStart);

  const headerSummary =
    view === "day"
      ? agendaForDay
        ? daySummary(agendaForDay)
        : ""
      : view === "month"
        ? monthSummary.total > 0
          ? `${Math.round((monthSummary.done / monthSummary.total) * 100)}% compliance · ${monthSummary.done} of ${monthSummary.total}`
          : "No check-ins this month"
        : weekSummary.total > 0
          ? `${Math.round((weekSummary.done / weekSummary.total) * 100)}% compliance · ${weekSummary.done} of ${weekSummary.total}`
          : "No check-ins this week";

  const handleCheckInItem = useCallback(
    async (item: DayAgendaItem, at: Date) => {
      await dispatch({
        type: "CreateCheckIn",
        checkInId: seqUuid(),
        habitId: item.habitId,
        timestamp: at,
      });
    },
    [],
  );

  const handleSkipItem = useCallback(async (item: DayAgendaItem, at: Date) => {
    await dispatch({
      type: "CreateCheckIn",
      checkInId: seqUuid(),
      habitId: item.habitId,
      timestamp: at,
      skipped: true,
    });
  }, []);

  const handleUndoItem = useCallback(async (item: DayAgendaItem) => {
    if (!item.checkInId) return;
    await dispatch({
      type: "DeleteCheckIn",
      checkInId: item.checkInId,
    });
  }, []);

  return (
    <GestureDetector gesture={swipeGesture}>
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
          <CalendarViewNav view={view} onChange={onChangeView} />
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

        {view === "day" ? (
          agendaForDay && (
            <DayView
              day={baseDay}
              agenda={agendaForDay}
              onCheckIn={handleCheckInItem}
              onSkip={handleSkipItem}
              onUndo={handleUndoItem}
            />
          )
        ) : (
          <>
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

            {/* Bottom panel — day check-ins, optionally filtered to one habit. */}
            <SelectedDayCheckIns
              day={selectedDay}
              today={today}
              weekStart={weekStart}
              groups={groupsForSelectedDay}
              filteredHabit={view === "week" ? filteredHabit : null}
              weekRowForFilter={view === "week" ? weekRowForFilter : null}
              onClearFilter={() => setSelectedHabitId(null)}
            />
          </>
        )}
      </ScrollView>
    </GestureDetector>
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
