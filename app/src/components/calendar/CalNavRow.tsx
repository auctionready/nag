import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

interface CalNavRowProps {
  /** Label for the center pill — "today" on month view, "this week" on week view. */
  todayLabel: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Disables the "next" pill when we're already at the latest window. */
  nextDisabled?: boolean;
  /**
   * True when the current window already covers today. The center pill
   * is then muted; otherwise it lights up orange (the cue to jump back).
   */
  onCurrent: boolean;
}

/**
 * Three-piece bottom-aligned nav: previous-period pill on the left,
 * a center "today" pill that turns orange when the user has navigated
 * away from now, and a next-period pill on the right. The two outer
 * pills carry chevrons and the actual period label (e.g. "Apr 13–19"),
 * so the user can see exactly where prev/next will land.
 */
export const CalNavRow = ({
  todayLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onToday,
  nextDisabled,
  onCurrent,
}: CalNavRowProps) => (
  <View style={styles.row}>
    <NavPill label={prevLabel} direction="prev" onPress={onPrev} />
    <Pressable
      onPress={onToday}
      style={[
        styles.centerPill,
        onCurrent ? styles.centerPillCurrent : styles.centerPillOff,
      ]}
      disabled={onCurrent}
      accessibilityRole="button"
      accessibilityLabel={`Jump to ${todayLabel}`}
    >
      <Text
        style={[
          styles.centerLabel,
          onCurrent ? styles.centerLabelCurrent : styles.centerLabelOff,
        ]}
      >
        {todayLabel}
      </Text>
    </Pressable>
    <NavPill
      label={nextLabel}
      direction="next"
      onPress={onNext}
      disabled={nextDisabled}
    />
  </View>
);

const NavPill = ({
  label,
  direction,
  onPress,
  disabled,
}: {
  label: string;
  direction: "prev" | "next";
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.navPill, disabled && styles.navPillDisabled]}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={direction === "prev" ? "Previous" : "Next"}
  >
    {direction === "prev" && <Chevron direction="prev" disabled={disabled} />}
    <Text style={[styles.navLabel, disabled && styles.navLabelDisabled]}>
      {label}
    </Text>
    {direction === "next" && <Chevron direction="next" disabled={disabled} />}
  </Pressable>
);

const Chevron = ({
  direction,
  disabled,
}: {
  direction: "prev" | "next";
  disabled?: boolean;
}) => (
  <Svg width={9} height={9} viewBox="0 0 11 11" fill="none">
    <Path
      d={direction === "prev" ? "M7 1L2.5 5.5L7 10" : "M4 1L8.5 5.5L4 10"}
      stroke={disabled ? tokens.faint : tokens.ink}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 6,
  },
  navPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.veryFaint,
  },
  navPillDisabled: {
    opacity: 0.5,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
  navLabelDisabled: {
    color: tokens.mute,
  },
  centerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  centerPillCurrent: {
    borderColor: tokens.border,
    backgroundColor: "transparent",
    opacity: 0.55,
  },
  centerPillOff: {
    borderColor: tokens.orange,
    backgroundColor: "rgba(255,90,54,0.08)",
  },
  centerLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  centerLabelCurrent: {
    color: tokens.mute,
  },
  centerLabelOff: {
    color: tokens.orange,
  },
});
