import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "../../infrastructure/syncStatus";
import { isApiConfigured } from "../../infrastructure/apiClient";
import { tokens } from "../theme";

interface SyncDotProps {
  /** Show the lowercase mono label next to the dot. */
  showLabel?: boolean;
}

const PALETTE = {
  online: { color: "#3CC07A", text: "synced" },
  syncing: { color: "#3B82F6", text: "syncing" },
  offline: { color: tokens.mute, text: "offline" },
  halted: { color: "#DC2626", text: "sync error" },
} as const;

type DotStatus = keyof typeof PALETTE;

/**
 * Compact sync indicator for the home board top bar — a 7px dot in
 * green/blue/grey/red, optionally labelled. Pulses while syncing.
 * Purely presentational — pairs with the top bar's avatar button
 * which is the canonical "open account" affordance, so we don't put
 * a tap target here that would steal touches from neighbouring
 * pressables.
 */
export const SyncDot = ({ showLabel = false }: SyncDotProps) => {
  const { status, pendingCount, isAnonymous } = useSyncStatus();

  const dotStatus = mapStatus(status);

  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (dotStatus !== "syncing") {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotStatus, pulse]);

  if (!isApiConfigured() || status === "disabled" || isAnonymous) return null;

  const palette = PALETTE[dotStatus];
  const label =
    dotStatus === "online" && pendingCount > 0
      ? `${pendingCount} pending`
      : palette.text;

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Sync status: ${palette.text}`}
    >
      <View style={styles.dotWrap}>
        {/* Halo stays mounted across status changes so the native-driven
            pulse interpolations don't get torn down mid-loop, which would
            log `Sending onAnimatedValueUpdate with no listeners registered`.
            When not syncing, pulse is 0 → haloOpacity is 0 (invisible). */}
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: palette.color,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <View style={[styles.dot, { backgroundColor: palette.color }]} />
      </View>
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
};

const mapStatus = (status: string): DotStatus => {
  switch (status) {
    case "syncing":
      return "syncing";
    case "offline":
      return "offline";
    case "halted":
      return "halted";
    default:
      return "online";
  }
};

const DOT = 7;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dotWrap: {
    width: DOT,
    height: DOT,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  halo: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  label: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    letterSpacing: 0.95,
    color: tokens.mute,
    textTransform: "uppercase",
  },
});
