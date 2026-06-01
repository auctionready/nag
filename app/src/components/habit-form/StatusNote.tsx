import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { HabitStatus } from "@nag/schema";
import { tokens } from "../theme";

export interface StatusNoteProps {
  status: HabitStatus;
}

/**
 * Compact paused-status note on the edit screen, mirroring the detail banner
 * at smaller scale. Only paused habits reach the editor (archived ones are
 * read-only and redirect away), so this only renders for `paused`.
 */
export const StatusNote = ({ status }: StatusNoteProps) => {
  if (status !== "paused") return null;

  return (
    <View style={styles.note}>
      <Svg width={15} height={15} viewBox="0 0 16 16" fill={tokens.orange}>
        <Rect x={4.5} y={3} width={2.4} height={10} rx={1} />
        <Rect x={9.1} y={3} width={2.4} height={10} rx={1} />
      </Svg>
      <Text style={styles.label}>
        paused — nags are off, still on your board
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
    backgroundColor: "rgba(255,90,54,0.08)",
    borderColor: "rgba(255,90,54,0.22)",
  },
  label: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: -0.06,
    color: tokens.orange,
  },
});
