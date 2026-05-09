import { forwardRef, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "../../../components/theme";
import { formatTime } from "../../../components/formatters";

export type TimeSlotPillState = "done" | "pending" | "owed" | "skipped";

interface TimeSlotPillProps {
  hour: number;
  minute: number;
  state: TimeSlotPillState;
  /**
   * Tap to open the Time-slot actions popover. Wired by the parent for
   * any pill the user can act on — `missed`/`owed` and the next
   * `upcoming` slot today (log mode), plus `done` and `skipped` slots
   * (delete mode). Pills with no action available stay inert.
   */
  onPress?: () => void;
  /**
   * When true, draws an orange ring around the pill — the popover anchor
   * the user just opened. Other pills stay un-ringed.
   */
  active?: boolean;
}

const OWED_BG = "rgba(255,90,54,0.12)";
const OWED_BORDER = "rgba(255,90,54,0.35)";

/**
 * Compact tiled pill carrying an icon + the slot's clock time. Same
 * visual vocabulary as the canvas mock: ink-filled with `✓` for done,
 * hairline ring for upcoming, orange tint for owed, mute strikethrough
 * for skipped. Tap → popover (handled by `TimeSlotsCard`).
 */
export const TimeSlotPill = forwardRef<View, TimeSlotPillProps>(
  ({ hour, minute, state, onPress, active }, ref) => {
    const interactive = onPress != null;
    const palette = paletteFor(state);
    const label = formatTime(hour, minute);

    // formatTime returns "h:mm AM/PM" — split so we can mono-style the time
    // and uppercase-mute the meridiem next to it.
    const [time, meridiem] = label.split(" ");

    // Pulse the pill whenever its visual state flips (e.g. owed → done
    // after a check-in lands), so the result feels acknowledged. Skips
    // the very first render so pills don't pulse when the screen mounts.
    const scale = useRef(new Animated.Value(1)).current;
    const prevState = useRef<TimeSlotPillState | null>(null);
    useEffect(() => {
      if (prevState.current !== null && prevState.current !== state) {
        scale.setValue(0.96);
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }).start();
      }
      prevState.current = state;
    }, [state, scale]);

    return (
      <Animated.View
        style={[
          active
            ? [styles.activeWrap, { shadowColor: tokens.orange }]
            : undefined,
          { transform: [{ scale }] },
        ]}
      >
        <Pressable
          ref={ref}
          onPress={interactive ? onPress : undefined}
          disabled={!interactive}
          accessibilityRole={interactive ? "button" : undefined}
          accessibilityLabel={
            interactive ? `Open actions for ${label}` : `${state} ${label}`
          }
          style={[
            styles.pill,
            { backgroundColor: palette.bg, borderColor: palette.border },
            active && { borderColor: tokens.orange },
          ]}
        >
          <Glyph state={state} color={palette.fg} />
          <Text
            style={[
              styles.time,
              { color: palette.fg },
              state === "skipped" && styles.strike,
            ]}
          >
            {time}
          </Text>
          <Text style={[styles.meridiem, { color: palette.fg }]}>
            {meridiem}
          </Text>
        </Pressable>
      </Animated.View>
    );
  },
);
TimeSlotPill.displayName = "TimeSlotPill";

const Glyph = ({
  state,
  color,
}: {
  state: TimeSlotPillState;
  color: string;
}) => {
  switch (state) {
    case "done":
      return (
        <Svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="none"
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M2 5.2L4.2 7.4L8 3.2" />
        </Svg>
      );
    case "owed":
      return (
        <Svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="none"
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Circle cx={5} cy={5} r={3.5} />
          <Path d="M5 4v.01M5 5.5v1.5" />
        </Svg>
      );
    case "skipped":
      return (
        <Svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <Path d="M2.5 7.5L7.5 2.5" />
        </Svg>
      );
    case "pending":
    default:
      return (
        <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
          <Circle
            cx={5}
            cy={5}
            r={3.5}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
        </Svg>
      );
  }
};

const paletteFor = (state: TimeSlotPillState) => {
  if (state === "done") {
    return { bg: tokens.ink, fg: tokens.cream, border: tokens.ink };
  }
  if (state === "owed") {
    return { bg: OWED_BG, fg: tokens.orange, border: OWED_BORDER };
  }
  if (state === "skipped") {
    return { bg: "transparent", fg: tokens.mute, border: tokens.border };
  }
  return { bg: "transparent", fg: tokens.ink, border: tokens.border };
};

const styles = StyleSheet.create({
  activeWrap: {
    borderRadius: 999,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingLeft: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  time: {
    fontFamily: "JetBrainsMono",
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  meridiem: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    opacity: 0.78,
    textTransform: "uppercase",
  },
  strike: {
    textDecorationLine: "line-through",
  },
});
