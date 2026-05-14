import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

interface CalNavRowProps {
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Disables the "next" pill when we're already at the latest window. */
  nextDisabled?: boolean;
  /**
   * True when tapping "today" would change nothing — i.e. the window
   * already covers today AND the selected day is today. The center pill
   * is then muted and disabled; otherwise it lights up orange to cue
   * the user back to now.
   */
  todayDisabled: boolean;
}

/**
 * Three-piece bottom-aligned nav: previous-period pill on the left,
 * a center "today" pill that turns orange when tapping it would do
 * something (different period, or different selected day), and a
 * next-period pill on the right. The two outer pills carry chevrons
 * and the actual period label (e.g. "Apr 13–19").
 */
export const CalNavRow = ({
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onToday,
  nextDisabled,
  todayDisabled,
}: CalNavRowProps) => (
  <View style={styles.row}>
    <NavPill label={prevLabel} direction="prev" onPress={onPrev} />
    <Pressable
      onPress={onToday}
      style={[
        styles.centerPill,
        todayDisabled ? styles.centerPillCurrent : styles.centerPillOff,
      ]}
      disabled={todayDisabled}
      accessibilityRole="button"
      accessibilityLabel="Jump to today"
    >
      <Text
        style={[
          styles.centerLabel,
          todayDisabled ? styles.centerLabelCurrent : styles.centerLabelOff,
        ]}
      >
        today
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
