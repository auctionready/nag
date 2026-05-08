import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

interface BellToggleProps {
  on: boolean;
}

// Read-only bell indicator on a schedule-entry row. Tints orange when the
// reminder push is enabled; otherwise sits muted with a diagonal cross-out.
// (The actual toggle lives inside the schedule editor — this just reflects
// state.)
export const BellToggle = ({ on }: BellToggleProps) => {
  const color = on ? tokens.orange : tokens.faint;
  return (
    <View style={[styles.box, on ? styles.boxOn : styles.boxOff]}>
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
      {!on && (
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  boxOn: {
    backgroundColor: "rgba(255,90,54,0.12)",
    borderColor: "rgba(255,90,54,0.25)",
  },
  boxOff: {
    backgroundColor: "transparent",
    borderColor: tokens.border,
  },
});
