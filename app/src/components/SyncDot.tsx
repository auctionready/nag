import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSyncStatus } from "../infrastructure/syncStatus";
import { isApiConfigured } from "../infrastructure/apiClient";
import { isClerkConfigured } from "../infrastructure/clerk";
import { tokens } from "./theme";

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
 * Wraps the app's `useSyncStatus` and tapping opens the Account screen
 * (matches the legacy SyncStatusPill behaviour).
 */
export const SyncDot = ({ showLabel = false }: SyncDotProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { status, pendingCount } = useSyncStatus();

  const dotStatus = mapStatus(status);

  const pulse = useRef(new Animated.Value(0)).current;
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

  if (!isApiConfigured() || status === "disabled") return null;

  const palette = PALETTE[dotStatus];
  const label =
    dotStatus === "online" && pendingCount > 0
      ? `${pendingCount} pending`
      : palette.text;

  const onPress = () => {
    if (pathname === "/account") return;
    if (isClerkConfigured()) router.push("/account");
  };

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const content = (
    <View style={styles.row}>
      <View style={styles.dotWrap}>
        {dotStatus === "syncing" && (
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
        )}
        <View style={[styles.dot, { backgroundColor: palette.color }]} />
      </View>
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${palette.text}`}
    >
      {content}
    </Pressable>
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
