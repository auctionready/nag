import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { ScheduleAlarmStatus } from "@nag/core";
import { tokens } from "../../components/theme";

interface BellGlyphProps {
  size: number;
  color: string;
  filled: boolean;
}

/** Outline (armed) or filled (ringing) bell, ported from the design BellGlyph. */
const BellGlyph = ({ size, color, filled }: BellGlyphProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? color : "none"}
    stroke={color}
    strokeWidth={filled ? 1.2 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 3a5.6 5.6 0 015.6 5.6c0 4.6 1.7 6.2 2.4 7a.6.6 0 01-.45 1H4.45a.6.6 0 01-.45-1c.7-.8 2.4-2.4 2.4-7A5.6 5.6 0 0112 3z" />
    <Path d="M10.1 20.3a2 2 0 003.8 0" fill="none" />
  </Svg>
);

interface AlarmBellProps {
  status: ScheduleAlarmStatus;
  /** Diameter of the circular badge. */
  size?: number;
}

/**
 * Corner badge on the habit icon, signalling this habit has a *timed* nag today.
 *
 *   - "armed"   — neutral outline bell on a white badge. A reminder is set for
 *                 today, still upcoming.
 *   - "overdue" — orange filled bell, ringing: it shakes (swinging from its
 *                 crown) inside a pulsing orange halo. The scheduled time passed
 *                 with no check-in.
 *   - "none"    — renders nothing.
 *
 * Distinct from the week strip's "scheduled today" cell: the bell means a
 * clock-time nag, not just "due sometime today". The shake + halo are
 * suppressed when the user has reduce-motion enabled (the static orange bell
 * still reads as overdue).
 */
export const AlarmBell = ({ status, size = 18 }: AlarmBellProps) => {
  const overdue = status === ScheduleAlarmStatus.Overdue;
  const [reduceMotion, setReduceMotion] = useState(false);
  // One looped clock (2.4s) drives both the shake and the halo, mirroring the
  // shared period of the design's `nagBellRing` / `nagBellHalo` keyframes.
  const [clock] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (mounted) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const animate = overdue && !reduceMotion;
  useEffect(() => {
    if (!animate) {
      clock.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, clock]);

  if (status === ScheduleAlarmStatus.None) return null;

  // Armed: neutral outline bell on a white badge, lifted off the icon box by a
  // 2px ring of the tile surface colour (the design's `0 0 0 2px tileBg`).
  if (!overdue) {
    return (
      <View style={[styles.ring, { borderRadius: (size + 4) / 2 }]}>
        <View
          style={[
            styles.armedBadge,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <BellGlyph size={size * 0.62} filled={false} color={tokens.mute} />
        </View>
      </View>
    );
  }

  // Overdue: orange filled bell on a transparent badge inside a pulsing halo.
  // The bell swings from its crown (transform-origin ≈ 50% 16% in the design),
  // emulated here by rotating about a pivot above centre.
  const bellSize = size * 0.66;
  const pivot = bellSize * 0.34;
  const rotate = clock.interpolate({
    inputRange: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.64, 1],
    outputRange: [
      "0deg",
      "12deg",
      "-12deg",
      "12deg",
      "-12deg",
      "12deg",
      "-12deg",
      "0deg",
      "0deg",
    ],
  });
  const haloScale = clock.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.7, 1.85, 1.85],
  });
  const haloOpacity = clock.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.55, 0, 0],
  });

  return (
    <View style={[styles.overdueBadge, { width: size, height: size }]}>
      {animate && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderRadius: (size - 2) / 2,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      )}
      <Animated.View
        style={
          animate
            ? {
                transform: [
                  { translateY: -pivot },
                  { rotate },
                  { translateY: pivot },
                ],
              }
            : undefined
        }
      >
        <BellGlyph size={bellSize} filled color={tokens.orange} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: -8,
    right: -8,
    padding: 2,
    backgroundColor: tokens.surface,
  },
  armedBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: "rgba(26,20,16,0.22)",
  },
  overdueBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 1.5,
    borderColor: tokens.orange,
  },
});
