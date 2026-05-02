import { Pressable, StyleSheet, Text, View } from "react-native";
import type { UseFormWatch } from "react-hook-form";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "../theme";
import { mondayFirstDayLetters } from "@nag/core";
import { formatTime, friendlyDaysLabel, type HabitFormData } from "./shared";

interface ScheduleEntrySummaryProps {
  index: number;
  watch: UseFormWatch<HabitFormData>;
  onEdit: () => void;
}

export const ScheduleEntrySummary = ({
  index,
  watch,
  onEdit,
}: ScheduleEntrySummaryProps) => {
  const hour = watch(`schedules.${index}.hour`);
  const minute = watch(`schedules.${index}.minute`);
  const days = watch(`schedules.${index}.days`) ?? 0;
  const reminder = watch(`schedules.${index}.reminder`) !== false;

  const time = formatTime(hour, minute);
  const [timeBody, period] = time.split(" ");
  const summary = friendlyDaysLabel(days);

  return (
    <Pressable style={styles.row} onPress={onEdit}>
      <View style={styles.clockBadge}>
        <ClockIcon />
      </View>
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
            <View style={styles.dayPills}>
              {mondayFirstDayLetters.map(({ day, letter }) => {
                const on = (days & day) !== 0;
                return (
                  <View
                    key={day}
                    style={[styles.dayPill, on && styles.dayPillActive]}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        on && styles.dayPillTextActive,
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <Text style={styles.hint}>tap to edit days &amp; time</Text>
      </View>
      <View style={[styles.bell, reminder ? styles.bellOn : styles.bellOff]}>
        <BellIcon color={reminder ? tokens.orange : tokens.faint} />
        {!reminder && <CrossOut />}
      </View>
    </Pressable>
  );
};

const ClockIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <Circle cx={7} cy={7} r={5.2} stroke={tokens.orange} strokeWidth={1.7} />
    <Path
      d="M7 4v3l2 1.5"
      stroke={tokens.orange}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const BellIcon = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M3.5 7a4.5 4.5 0 019 0v3l1.2 1.7H2.3L3.5 10V7z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.5 13.5a1.5 1.5 0 003 0"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CrossOut = () => (
  <Svg
    width={22}
    height={22}
    viewBox="0 0 22 22"
    fill="none"
    style={StyleSheet.absoluteFill}
  >
    <Path
      d="M3 3l16 16"
      stroke={tokens.faint}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Svg>
);

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
  clockBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,90,54,0.1)",
    alignItems: "center",
    justifyContent: "center",
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
  dayPills: {
    flexDirection: "row",
    gap: 3,
  },
  dayPill: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: tokens.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillActive: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  dayPillText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: tokens.mute,
  },
  dayPillTextActive: {
    color: tokens.cream,
  },
  hint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bellOn: {
    backgroundColor: "rgba(255,90,54,0.12)",
    borderColor: "rgba(255,90,54,0.25)",
  },
  bellOff: {
    backgroundColor: "transparent",
    borderColor: tokens.border,
  },
});
