import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

/**
 * Read-only footer shown on an archived habit's detail screen in place of
 * the check-in / skip actions: archived habits can't be logged against.
 * Unarchiving is offered by the status banner at the top of the screen.
 */
export const ArchivedFooter = () => {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: 14 + bottom }]}>
      <View style={styles.note}>
        <Svg
          width={13}
          height={13}
          viewBox="0 0 14 14"
          fill="none"
          stroke={tokens.mute}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M2 4.5h10v2.2h-10z" />
          <Path d="M3 6.7v4.3a1 1 0 001 1h6a1 1 0 001-1V6.7" />
          <Path d="M5.6 9h2.8" />
        </Svg>
        <Text style={styles.noteText}>read-only · unarchive above to log</Text>
      </View>
      <Text style={styles.sub}>archived habits keep their record</Text>
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
  note: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  noteText: {
    color: tokens.mute,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.14,
  },
  sub: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
