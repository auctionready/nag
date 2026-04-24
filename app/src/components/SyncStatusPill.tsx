import { StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "../infrastructure/syncStatus";

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
  const { status, pendingCount } = useSyncStatus();
  if (status === "disabled") return null;

  const palette = COLORS[status] ?? COLORS.idle;
  const label =
    status === "idle" && pendingCount > 0
      ? `${pendingCount} pending`
      : (TEXT[status] ?? "");

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
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
    </View>
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
