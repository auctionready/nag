import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Circle } from "react-native-svg";

const ORANGE = "#FF5A36";
const CREAM = "#FFF8F0";
const INK = "#1A1410";
const INK_SOFT = "#2A211B";

// Match the native splash icon (expo-splash-screen plugin imageWidth)
// so the icon stays put across the native -> JS hand-off.
const ICON_SIZE = 280;

const HOLD_MS = 1800;
const EXIT_MS = 320;
const TAGLINE_FADE_END_MS = 300 + 700;

export const SPLASH_DURATION_MS = TAGLINE_FADE_END_MS + HOLD_MS + EXIT_MS;

export const AnimatedSplash: React.FC = () => {
  const fadeDots = useRef(new Animated.Value(0)).current;
  const fadeDotsY = useRef(new Animated.Value(8)).current;
  const fadeText = useRef(new Animated.Value(0)).current;
  const fadeTextY = useRef(new Animated.Value(8)).current;
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hand off from native to JS on the next frame: gives the JS view a
    // tick to mount before the native splash is hidden, so there's no flash.
    const raf = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => undefined);
    });

    const fadeUp = (val: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(val, {
          toValue: 1,
          duration: 700,
          delay,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 700,
          delay,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
      ]);
    Animated.parallel([
      fadeUp(fadeDots, fadeDotsY, 150),
      fadeUp(fadeText, fadeTextY, 300),
    ]).start();

    const dotPulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.25,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
    dotPulse(dot1, 0).start();
    dotPulse(dot2, 150).start();
    dotPulse(dot3, 300).start();

    Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();

    const t = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, TAGLINE_FADE_END_MS + HOLD_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      // Stop the looping animations so their native handles are released when
      // React removes the component, preventing the native view from
      // outliving the JS tree. Non-looping values (fade-in, exit) are left
      // alone so a Strict-Mode double-invocation doesn't make the view blank.
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
      sweep.stopAnimation();
    };
  }, [exit, fadeDots, fadeDotsY, fadeText, fadeTextY, dot1, dot2, dot3, sweep]);

  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-ICON_SIZE * 1.1, ICON_SIZE * 1.1],
  });

  return (
    <Animated.View
      style={[styles.root, { opacity: exit }]}
      pointerEvents="none"
    >
      <View style={styles.iconWrap}>
        <CadenceIcon />
        <View style={styles.sweepClip}>
          <Animated.View
            style={[
              styles.sweep,
              { transform: [{ translateX: sweepX }, { skewX: "-12deg" }] },
            ]}
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.loadingDots,
          { opacity: fadeDots, transform: [{ translateY: fadeDotsY }] },
        ]}
      >
        <Animated.View
          style={[
            styles.loadingDot,
            { opacity: dot1, transform: [{ scale: dotScale(dot1) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDot,
            { opacity: dot2, transform: [{ scale: dotScale(dot2) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDot,
            { opacity: dot3, transform: [{ scale: dotScale(dot3) }] },
          ]}
        />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tagline,
          { opacity: fadeText, transform: [{ translateY: fadeTextY }] },
        ]}
      >
        loading your excuses…
      </Animated.Text>
    </Animated.View>
  );
};

const dotScale = (v: Animated.Value) =>
  v.interpolate({ inputRange: [0.25, 1], outputRange: [0.85, 1] });

const CadenceIcon: React.FC = () => {
  const size = ICON_SIZE;
  const dotW = size * 0.08;
  const gap = size * 0.04;
  const states = [1, 1, 1, 0, 1, 1, 2] as const;
  return (
    <View
      style={[
        styles.cadence,
        { width: size, height: size, borderRadius: size * 0.225 },
      ]}
    >
      <View style={[styles.cadenceRow, { gap }]}>
        {states.map((s, i) => {
          if (s === 0) {
            return <DashedDot key={i} size={dotW} />;
          }
          return (
            <View
              key={i}
              style={{
                width: dotW,
                height: dotW,
                borderRadius: dotW / 2,
                backgroundColor: s === 1 ? INK : ORANGE,
              }}
            />
          );
        })}
      </View>
      <Text
        style={{
          fontFamily: "SpaceGrotesk-Bold",
          fontWeight: "700",
          fontSize: size * 0.42,
          lineHeight: size * 0.42,
          color: INK,
          letterSpacing: -size * 0.42 * 0.05,
          marginTop: size * 0.08,
        }}
      >
        nag
      </Text>
    </View>
  );
};

const DashedDot: React.FC<{ size: number }> = ({ size }) => (
  <Svg width={size} height={size}>
    <Circle
      cx={size / 2}
      cy={size / 2}
      r={size / 2 - 1}
      stroke={INK}
      strokeWidth={2}
      strokeDasharray="3 3"
      fill="transparent"
    />
  </Svg>
);

const SCREEN = Dimensions.get("window");

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    position: "relative",
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  cadence: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  cadenceRow: {
    flexDirection: "row",
    marginBottom: ICON_SIZE * 0.04,
  },
  sweepClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: ICON_SIZE * 0.225,
    overflow: "hidden",
  },
  sweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: ICON_SIZE * 0.4,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  loadingDots: {
    flexDirection: "row",
    marginTop: 32,
    gap: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },
  tagline: {
    marginTop: 28,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 14,
    color: INK_SOFT,
    letterSpacing: 0.5,
  },
});
