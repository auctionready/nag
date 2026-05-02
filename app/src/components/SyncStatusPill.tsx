import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSyncStatus } from "../infrastructure/syncStatus";
import { isApiConfigured } from "../infrastructure/apiClient";
import { isClerkConfigured } from "../infrastructure/clerk";

const TEXT: Record<string, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
  halted: "Sync error",
};

const COLORS: Record<string, { bg: string; fg: string }> = {
  idle: { bg: "#E7F6EC", fg: "#1F7A3A" },
  syncing: { bg: "#E8F0FE", fg: "#1A56C4" },
  offline: { bg: "#F2F2F2", fg: "#555" },
  halted: { bg: "#FDECEC", fg: "#B42318" },
};

export const SyncStatusPill = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { status, pendingCount, isAnonymous } = useSyncStatus();

  // Hide entirely when sync isn't wired in this build (no API config),
  // even if the upstream context drifts from the "disabled" status.
  // Also hide while anonymous — the dispatcher/pull-sync are intentionally
  // not running, and the user already sees a "sign in" affordance on the
  // account screen rather than a sync state for an account they don't have.
  if (!isApiConfigured() || status === "disabled" || isAnonymous) return null;

  // Already on the Account screen — pressing the pill there would push
  // another /account entry onto the stack. Hide instead.
  if (pathname === "/account") return null;

  const palette = COLORS[status] ?? COLORS.idle;
  const label =
    status === "idle" && pendingCount > 0
      ? `${pendingCount} pending`
      : (TEXT[status] ?? "");

  // Tapping the pill takes you to the Account screen — the visible entry
  // point for sign-in (no admin route is exposed in the navigation tree).
  // When Clerk isn't configured the screen shows a setup hint instead.
  const onPress = () => {
    if (isClerkConfigured()) router.push("/account");
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.pill, { backgroundColor: palette.bg }]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: palette.fg,
            opacity: status === "syncing" ? 0.6 : 1,
          },
        ]}
      />
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
