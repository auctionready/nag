import { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../../components/theme";

interface ActionFooterProps {
  showSkip: boolean;
  /** Tap → log immediately. */
  onCheckIn: () => void;
  /** Long-press → open the retro time-picker for a check-in. */
  onLongPressCheckIn: () => void;
  /** Tap → log a skip immediately. */
  onSkip: () => void;
  /** Long-press → open the retro time-picker for a skip. */
  onLongPressSkip: () => void;
}

/**
 * Sticky check-in / skip footer. Tap logs against now; long-press opens
 * the retro time-picker so a deemed time can be back-filled. The
 * inline mono caption explains the long-press affordance so users
 * don't need to discover it accidentally.
 */
export const ActionFooter = ({
  showSkip,
  onCheckIn,
  onLongPressCheckIn,
  onSkip,
  onLongPressSkip,
}: ActionFooterProps) => {
  const { bottom } = useSafeAreaInsets();
  // Pressable.onPress fires on finger-up even after the long-press gesture
  // has already triggered — the refs let the tap handlers swallow that
  // trailing press and avoid double-firing the action.
  const didCheckInLongPress = useRef(false);
  const didSkipLongPress = useRef(false);

  const checkInGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(500)
        .runOnJS(true)
        // onStart fires asynchronously when the gesture engages, not during render.
        // eslint-disable-next-line react-hooks/refs
        .onStart(() => {
          didCheckInLongPress.current = true;
          onLongPressCheckIn();
        }),
    [onLongPressCheckIn],
  );
  const skipGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(500)
        .runOnJS(true)
        // onStart fires asynchronously when the gesture engages, not during render.
        // eslint-disable-next-line react-hooks/refs
        .onStart(() => {
          didSkipLongPress.current = true;
          onLongPressSkip();
        }),
    [onLongPressSkip],
  );

  const handleCheckInTap = () => {
    if (didCheckInLongPress.current) {
      didCheckInLongPress.current = false;
      return;
    }
    onCheckIn();
  };
  const handleSkipTap = () => {
    if (didSkipLongPress.current) {
      didSkipLongPress.current = false;
      return;
    }
    onSkip();
  };

  return (
    <View style={[styles.wrap, { paddingBottom: 12 + bottom }]}>
      <View style={styles.row}>
        <GestureDetector gesture={checkInGesture}>
          <Pressable
            onPress={handleCheckInTap}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.primaryPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Check-in"
          >
            <Svg
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              stroke={tokens.cream}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M2.5 7L6 10.5L11.5 4" />
            </Svg>
            <Text style={styles.primaryText}>Check-in</Text>
          </Pressable>
        </GestureDetector>
        {showSkip && (
          <GestureDetector gesture={skipGesture}>
            <Pressable
              onPress={handleSkipTap}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.secondaryPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip"
            >
              <Text style={styles.secondaryText}>Skip</Text>
            </Pressable>
          </GestureDetector>
        )}
      </View>
      <Text style={styles.hint}>
        tap to log now · long-press to set a different time
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  primary: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: tokens.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryText: {
    color: tokens.cream,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  secondary: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  secondaryText: {
    color: tokens.ink,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  hint: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
