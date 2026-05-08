import { Pressable, StyleSheet, Text, View } from "react-native";
import { mondayFirstDayLetters, NoDays } from "@nag/core";
import { tokens } from "../theme";

interface WeekdayPillsProps {
  days: number;
  // When provided the pills become tap targets that toggle the day bit.
  // When omitted the row is purely informational.
  onToggle?: (day: number) => void;
  size?: "sm" | "md";
}

// Monday-first row of single-letter day pills. Active days get an ink fill;
// inactive days get a hairline border. Used in two places:
//  - the collapsed schedule-entry row (sm, read-only)
//  - the schedule editor (md, interactive day picker)
export const WeekdayPills = ({
  days,
  onToggle,
  size = "sm",
}: WeekdayPillsProps) => {
  const sizeStyle = size === "md" ? styles.pillMd : styles.pillSm;
  const textStyle = size === "md" ? styles.textMd : styles.textSm;

  return (
    <View style={size === "md" ? styles.rowMd : styles.rowSm}>
      {mondayFirstDayLetters.map(({ day, letter }) => {
        const on = ((days ?? NoDays) & day) !== 0;
        const pillStyle = [sizeStyle, on ? styles.pillActive : styles.pillIdle];
        const labelStyle = [
          textStyle,
          on ? styles.textActive : styles.textIdle,
        ];
        const inner = <Text style={labelStyle}>{letter}</Text>;

        if (!onToggle) {
          return (
            <View key={day} style={pillStyle}>
              {inner}
            </View>
          );
        }

        return (
          <Pressable key={day} style={pillStyle} onPress={() => onToggle(day)}>
            {inner}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  rowSm: {
    flexDirection: "row",
    gap: 3,
  },
  rowMd: {
    flexDirection: "row",
    gap: 6,
  },
  pillSm: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillMd: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillIdle: {
    borderColor: tokens.border,
    backgroundColor: "transparent",
  },
  pillActive: {
    borderColor: tokens.ink,
    backgroundColor: tokens.ink,
  },
  textSm: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  textMd: {
    fontSize: 13,
    fontWeight: "600",
  },
  textIdle: {
    color: tokens.mute,
  },
  textActive: {
    color: tokens.cream,
  },
});
