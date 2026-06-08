import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ScheduleAlarmState } from "@nag/core";
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
  state: ScheduleAlarmState;
  /** Diameter of the circular badge. */
  size?: number;
}

/**
 * Corner badge on the habit icon, signalling this habit has a *timed* nag today.
 *
 *   - "armed"   — neutral outline bell. A reminder is set for today, upcoming.
 *   - "overdue" — orange filled bell, ringing (shake + expanding halo). The
 *                 scheduled time passed with no check-in.
 *   - "none"    — renders nothing.
 *
 * Distinct from the week strip's "scheduled today" cell: the bell means a
 * clock-time nag, not just "due sometime today". Animations are suppressed when
 * the user has reduce-motion enabled (the static orange bell still reads as
 * overdue).
 */
export const AlarmBell = ({ state, size = 18 }: AlarmBellProps) => {
  const overdue = state === "overdue";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const [halo] = useState(() => new Animated.Value(0));

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
      shake.setValue(0);
      halo.setValue(0);
      return;
    }
    // Brief shake then rest, on the same 2.4s cadence as the design CSS.
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulse = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    ring.start();
    pulse.start();
    return () => {
      ring.stop();
      pulse.stop();
    };
  }, [animate, shake, halo]);

  if (state !== "armed" && state !== "overdue") return null;

  const rotate = shake.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1],
    outputRange: ["0deg", "12deg", "-12deg", "12deg", "-12deg", "0deg"],
  });
  const haloScale = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.85],
  });
  const haloOpacity = halo.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.55, 0, 0],
  });

  // The badge sits inside a 2px ring of the tile surface colour so it reads as
  // lifted off the icon box (the design's `0 0 0 2px tileBg` box-shadow).
  return (
    <Animated.View style={[styles.ring, { borderRadius: (size + 4) / 2 }]}>
      <Animated.View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: overdue ? tokens.orange : tokens.surface,
            borderWidth: overdue ? 0 : 1,
            borderColor: "rgba(26,20,16,0.22)",
          },
        ]}
      >
        {animate && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                borderRadius: size / 2,
                opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              },
            ]}
          />
        )}
        <Animated.View
          style={animate ? { transform: [{ rotate }] } : undefined}
        >
          <BellGlyph
            size={size * 0.62}
            filled={overdue}
            color={overdue ? tokens.cream : tokens.mute}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
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
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1.5,
    borderColor: tokens.orange,
  },
});
