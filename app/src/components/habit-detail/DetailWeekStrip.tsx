import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { addDays, isAfter, startOfWeek } from "date-fns";
import Svg, { Line, Path } from "react-native-svg";
import { dayTitles, isSameCalendarDay, mondayFirstDayLetters } from "@nag/core";
import { useStartOfToday } from "../../infrastructure/today";
import { tokens } from "../../components/theme";

type CellState =
  | "done"
  | "today-done"
  | "today"
  | "partial"
  | "today-partial"
  | "missed"
  | "future"
  | "skip";

interface DetailWeekStripProps {
  scheduledDaysMask: number;
  /** Days where every scheduled time-slot has a check-in (full completion). */
  checkedInDaysMask: number;
  /** Days where some — but not all — scheduled time-slots have a check-in. */
  partialDaysMask?: number;
  /** Days with at least one check-in regardless of schedule. */
  anyCheckInDaysMask?: number;
  /** Currently selected day (highlighted) or null when none. */
  selectedDay: Date | null;
  /** Pass null to clear an existing selection. */
  onSelectDay: (day: Date | null) => void;
}

/**
 * Detail-screen week strip — Monday-first cells using the same
 * `done · today · partial · missed · future · skip` glyph language as
 * the home tile (`DayIndicators`), but rendered larger with a date
 * caption underneath and the selected cell ringed in ink. Tap a cell to
 * scope the slots/check-ins panels below to that day.
 */
export const DetailWeekStrip = ({
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask = 0,
  anyCheckInDaysMask = 0,
  selectedDay,
  onSelectDay,
}: DetailWeekStripProps) => {
  const todayStart = useStartOfToday();
  const monday = startOfWeek(todayStart, { weekStartsOn: 1 });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>this week</Text>
        <Text style={styles.hint}>tap a day to scope below</Text>
      </View>
      <View style={styles.row}>
        {mondayFirstDayLetters.map(({ day, letter }, i) => {
          const cellDate = addDays(monday, i);
          const state = stateFor({
            day,
            cellDate,
            todayStart,
            scheduledDaysMask,
            checkedInDaysMask,
            partialDaysMask,
            anyCheckInDaysMask,
          });
          const isToday = isSameCalendarDay(cellDate, todayStart);
          const isSelected =
            selectedDay !== null && isSameCalendarDay(cellDate, selectedDay);
          const isFuture = isAfter(cellDate, todayStart);
          const dayNumber = cellDate.getDate();

          return (
            <Pressable
              key={i}
              onPress={() =>
                isFuture ? undefined : onSelectDay(isSelected ? null : cellDate)
              }
              disabled={isFuture}
              accessibilityRole="button"
              accessibilityLabel={`Select ${dayTitles[day]}`}
              accessibilityState={{ selected: isSelected, disabled: isFuture }}
              style={[
                styles.col,
                isSelected && styles.colSelected,
                isFuture && styles.colFuture,
              ]}
            >
              <Text
                style={[
                  styles.letter,
                  isSelected
                    ? styles.letterSelected
                    : isToday
                      ? styles.letterToday
                      : null,
                ]}
              >
                {letter}
              </Text>
              <CellGlyph state={state} />
              <Text style={styles.dateNumber}>{dayNumber}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

interface StateForArgs {
  day: number;
  cellDate: Date;
  todayStart: Date;
  scheduledDaysMask: number;
  checkedInDaysMask: number;
  partialDaysMask: number;
  anyCheckInDaysMask: number;
}

const stateFor = ({
  day,
  cellDate,
  todayStart,
  scheduledDaysMask,
  checkedInDaysMask,
  partialDaysMask,
  anyCheckInDaysMask,
}: StateForArgs): CellState => {
  const scheduled = (scheduledDaysMask & day) !== 0;
  const checkedIn = (checkedInDaysMask & day) !== 0;
  const partial = (partialDaysMask & day) !== 0;
  const anyCheckIn = (anyCheckInDaysMask & day) !== 0;
  const isToday = isSameCalendarDay(cellDate, todayStart);
  const isPast = cellDate < todayStart && !isToday;

  if (scheduled && checkedIn) return isToday ? "today-done" : "done";
  if (!scheduled && anyCheckIn) return "done";
  if (scheduled && partial) return isToday ? "today-partial" : "partial";
  if (isToday && scheduled) return "today";
  if (scheduled && isPast) return "missed";
  if (scheduled) return "future";
  return "skip";
};

const PARTIAL_RATIO = 0.5;

const CellGlyph = ({ state }: { state: CellState }) => {
  const cellStyle: ViewStyle[] = [styles.cell];
  let inner: React.ReactNode = null;

  switch (state) {
    case "done":
      cellStyle.push(styles.cellInk);
      inner = <CheckMark />;
      break;
    case "today-done":
      cellStyle.push(styles.cellInk, styles.cellTodayRing);
      inner = <CheckMark />;
      break;
    case "today":
      cellStyle.push(styles.cellTodayRing);
      break;
    case "partial":
      cellStyle.push(styles.cellFaintRing);
      inner = <PartialFill ratio={PARTIAL_RATIO} />;
      break;
    case "today-partial":
      cellStyle.push(styles.cellTodayRing);
      inner = <PartialFill ratio={PARTIAL_RATIO} />;
      break;
    case "missed":
      cellStyle.push(styles.cellFaintRing);
      inner = <SlashGlyph />;
      break;
    case "future":
      cellStyle.push(styles.cellFaintRing);
      break;
    case "skip":
      cellStyle.push(styles.cellSkip);
      break;
  }

  return <View style={cellStyle}>{inner}</View>;
};

const CheckMark = () => (
  <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
    <Path
      d="M2 5L4.2 7.2L8 3"
      stroke={tokens.cream}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SlashGlyph = () => (
  <Svg width="100%" height="100%" viewBox="0 0 22 22" fill="none">
    <Line
      x1={6}
      y1={16}
      x2={16}
      y2={6}
      stroke={tokens.mute}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  </Svg>
);

const PartialFill = ({ ratio }: { ratio: number }) => (
  <View
    style={[
      styles.partialFill,
      { height: `${Math.max(0, Math.min(1, ratio)) * 100}%` },
    ]}
  />
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    padding: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  hint: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  col: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    gap: 6,
  },
  colSelected: {
    backgroundColor: tokens.inkTint,
    borderColor: tokens.ink,
  },
  colFuture: {
    opacity: 0.85,
  },
  letter: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: tokens.mute,
    fontWeight: "400",
  },
  letterToday: {
    color: tokens.orange,
    fontWeight: "700",
  },
  letterSelected: {
    color: tokens.ink,
    fontWeight: "700",
  },
  dateNumber: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
  cell: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  cellInk: {
    backgroundColor: tokens.ink,
  },
  cellTodayRing: {
    borderColor: tokens.orange,
  },
  cellFaintRing: {
    borderColor: tokens.faint,
  },
  cellSkip: {
    backgroundColor: tokens.veryFaint,
  },
  partialFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.ink,
  },
});
