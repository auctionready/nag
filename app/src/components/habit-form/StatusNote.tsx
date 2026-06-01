import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { HabitStatus } from "@nag/schema";
import { tokens } from "../theme";

export interface StatusNoteProps {
  status: HabitStatus;
}

/**
 * Compact one-line status note on the edit screen, mirroring the detail
 * banner at smaller scale. Renders nothing for an active habit.
 */
export const StatusNote = ({ status }: StatusNoteProps) => {
  if (status === "active") return null;
  const paused = status === "paused";
  const color = paused ? tokens.orange : tokens.mute;

  return (
    <View
      style={[styles.note, paused ? styles.notePaused : styles.noteArchived]}
    >
      {paused ? (
        <Svg width={15} height={15} viewBox="0 0 16 16" fill={color}>
          <Rect x={4.5} y={3} width={2.4} height={10} rx={1} />
          <Rect x={9.1} y={3} width={2.4} height={10} rx={1} />
        </Svg>
      ) : (
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
          <Rect
            x={2.5}
            y={3}
            width={11}
            height={3}
            rx={1}
            stroke={color}
            strokeWidth={1.6}
          />
          <Path
            d="M3.5 6.5v6.5a1 1 0 001 1h7a1 1 0 001-1V6.5"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M6.5 9h3"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <Text style={[styles.label, { color }]}>
        {paused
          ? "paused — nags are off, still on your board"
          : "archived — hidden from your board"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notePaused: {
    backgroundColor: "rgba(255,90,54,0.08)",
    borderColor: "rgba(255,90,54,0.22)",
  },
  noteArchived: {
    backgroundColor: tokens.inkTint,
    borderColor: tokens.border,
  },
  label: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.06,
  },
});
