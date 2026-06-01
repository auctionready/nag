import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

export interface ArchivedFooterProps {
  onUnarchive: () => void;
}

/**
 * Read-only footer shown on an archived habit's detail screen in place of
 * the check-in / skip actions: archived habits can't be logged against
 * until they're brought back.
 */
export const ArchivedFooter = ({ onUnarchive }: ArchivedFooterProps) => {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: 14 + bottom }]}>
      <Pressable
        onPress={onUnarchive}
        accessibilityRole="button"
        accessibilityLabel="Unarchive to log check-ins"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Svg
          width={14}
          height={14}
          viewBox="0 0 14 14"
          fill="none"
          stroke={tokens.mute}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M7 10.5V4M4 6.5L7 3.5 10 6.5" />
        </Svg>
        <Text style={styles.buttonText}>unarchive to log check-ins</Text>
      </Pressable>
      <Text style={styles.sub}>
        archived habits stay read-only · history is kept
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: tokens.cream,
    borderTopWidth: 1,
    borderTopColor: tokens.veryFaint,
    gap: 6,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: tokens.mute,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  sub: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
