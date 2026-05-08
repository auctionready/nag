import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "../../infrastructure/syncStatus";

/**
 * Admin-screen panel that surfaces the sync pipeline's current state
 * (status, pending/failed counts, last error, Resume action). Renders
 * nothing when sync is disabled (no API base URL / key configured).
 */
export const SyncStatusPanel = () => {
  const { status, pendingCount, failedCount, lastError, resume } =
    useSyncStatus();

  if (status === "disabled") return null;

  // Surface Resume whenever the pipeline is stuck — halted on a 4xx, or
  // transient-offline with at least one pending row. Same treatment as
  // SyncHaltedBanner so the user has a button to push from either place.
  const showResume =
    status === "halted" || (status === "offline" && pendingCount > 0);

  return (
    <View style={styles.syncBox}>
      <Text style={styles.syncLine}>Status: {status}</Text>
      <Text style={styles.syncLine}>Pending: {pendingCount}</Text>
      {failedCount > 0 ? (
        <Text style={styles.syncLine}>Failed: {failedCount}</Text>
      ) : null}
      {lastError ? (
        <Text style={styles.syncError} numberOfLines={3}>
          {lastError}
        </Text>
      ) : null}
      {showResume ? (
        <Pressable
          style={styles.resumeButton}
          onPress={() => {
            void resume();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.resumeButtonText}>Resume sync</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  syncBox: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  syncLine: {
    fontSize: 13,
    color: "#333",
  },
  syncError: {
    marginTop: 4,
    fontSize: 12,
    color: "#B42318",
  },
  resumeButton: {
    marginTop: 8,
    backgroundColor: "#B42318",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  resumeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
