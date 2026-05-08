import { Pressable, StyleSheet, Text, View } from "react-native";
import type { UseFormWatch } from "react-hook-form";
import { tokens } from "../theme";
import { BellToggle } from "./BellToggle";
import { ClockBadge } from "./ClockBadge";
import { WeekdayPills } from "./WeekdayPills";
import { formatTime, friendlyDaysLabel } from "../formatters";
import { parseFormTime, type HabitFormData } from "./shared";

interface ScheduleEntrySummaryProps {
  index: number;
  watch: UseFormWatch<HabitFormData>;
  onEdit: () => void;
}

// Collapsed schedule-entry row: clock badge + time + smart day summary
// (or pill row when the day mask doesn't match a friendly label) + bell.
export const ScheduleEntrySummary = ({
  index,
  watch,
  onEdit,
}: ScheduleEntrySummaryProps) => {
  const hour = watch(`schedules.${index}.hour`);
  const minute = watch(`schedules.${index}.minute`);
  const days = watch(`schedules.${index}.days`) ?? 0;
  const reminder = watch(`schedules.${index}.reminder`) !== false;

  const { hour: h, minute: m } = parseFormTime(hour, minute);
  const time = formatTime(h, m);
  const [timeBody, period] = time.split(" ");
  const summary = friendlyDaysLabel(days);

  return (
    <Pressable style={styles.row} onPress={onEdit}>
      <ClockBadge />
      <View style={styles.content}>
        <View style={styles.topLine}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeText}>{timeBody}</Text>
            <Text style={styles.periodText}>{period.toLowerCase()}</Text>
          </View>
          {summary ? (
            <View style={styles.summaryBlock}>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          ) : (
            <WeekdayPills days={days} />
          )}
        </View>
        <Text style={styles.hint}>tap to edit days &amp; time</Text>
      </View>
      <BellToggle on={reminder} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  timeText: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: 0.2,
  },
  periodText: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
  summaryBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    color: tokens.faint,
    fontSize: 13,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "500",
    color: tokens.ink,
  },
  hint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
});
