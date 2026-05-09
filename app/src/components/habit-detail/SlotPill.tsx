import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "../../components/theme";
import { formatTime } from "../../components/formatters";

export type SlotState = "done" | "pending" | "owed" | "skipped";

interface SlotPillProps {
  hour: number;
  minute: number;
  state: SlotState;
  /**
   * Long-press to back-fill this slot. Only wired for `pending`/`owed`
   * states (you can't double-record a `done` slot, and a `skipped` row is
   * already terminal).
   */
  onLongPress?: () => void;
}

const OWED_BG = "rgba(255,90,54,0.12)";
const OWED_BORDER = "rgba(255,90,54,0.35)";

/**
 * Compact tiled pill carrying an icon + the slot's clock time. Same
 * visual vocabulary as the canvas mock: ink-filled with `✓` for done,
 * hairline ring for upcoming, orange tint for owed, mute strikethrough
 * for skipped.
 */
export const SlotPill = ({
  hour,
  minute,
  state,
  onLongPress,
}: SlotPillProps) => {
  const canBackfill =
    onLongPress != null && state !== "done" && state !== "skipped";
  const longPress = Gesture.LongPress()
    .minDuration(500)
    .enabled(canBackfill)
    .onStart(() => {
      onLongPress?.();
    });

  const palette = paletteFor(state);
  const label = formatTime(hour, minute);

  // formatTime returns "h:mm AM/PM" — split so we can mono-style the time
  // and uppercase-mute the meridiem next to it.
  const [time, meridiem] = label.split(" ");

  return (
    <GestureDetector gesture={longPress}>
      <View
        style={[
          styles.pill,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
        accessibilityRole={canBackfill ? "button" : undefined}
        accessibilityLabel={
          canBackfill ? `Long-press to back-fill ${label}` : `${state} ${label}`
        }
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
        <Text style={[styles.meridiem, { color: palette.fg }]}>{meridiem}</Text>
      </View>
    </GestureDetector>
  );
};

const Glyph = ({ state, color }: { state: SlotState; color: string }) => {
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

const paletteFor = (state: SlotState) => {
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
