import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

interface CalNavRowProps {
  currentLabel: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Disables the "next" arrow when we're already at the latest window. */
  nextDisabled?: boolean;
  /** Disables the "today" pill when the current window already covers today. */
  todayDisabled?: boolean;
}

export const CalNavRow = ({
  currentLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onToday,
  nextDisabled,
  todayDisabled,
}: CalNavRowProps) => (
  <View style={styles.row}>
    <ArrowButton direction="left" onPress={onPrev} />
    <View style={styles.center}>
      <Text style={styles.title} numberOfLines={1}>
        {currentLabel}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {prevLabel.toLowerCase()} · {nextLabel.toLowerCase()}
      </Text>
    </View>
    <ArrowButton direction="right" onPress={onNext} disabled={nextDisabled} />
    <Pressable
      onPress={onToday}
      style={[styles.todayPill, todayDisabled && styles.todayPillDisabled]}
      disabled={todayDisabled}
      accessibilityRole="button"
      accessibilityLabel="Jump to today"
    >
      <Text
        style={[styles.todayLabel, todayDisabled && styles.todayLabelDisabled]}
      >
        today
      </Text>
    </Pressable>
  </View>
);

const ArrowButton = ({
  direction,
  onPress,
  disabled,
}: {
  direction: "left" | "right";
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.arrowBtn, disabled && styles.arrowBtnDisabled]}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={direction === "left" ? "Previous" : "Next"}
  >
    <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
      <Path
        d={direction === "left" ? "M7 1L2.5 5.5L7 10" : "M4 1L8.5 5.5L4 10"}
        stroke={disabled ? tokens.faint : tokens.ink}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.veryFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.5,
  },
  center: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  title: {
    fontSize: 13.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.15,
  },
  subtitle: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  todayPill: {
    marginLeft: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  todayPillDisabled: {
    opacity: 0.5,
  },
  todayLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  todayLabelDisabled: {
    color: tokens.mute,
  },
});
