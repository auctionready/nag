import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "../../infrastructure/syncStatus";

/**
 * Calm "Sync paused" affordance shown when the user has paused sync
 * via the sign-out dialog's "Pause server sync" option. Distinct from
 * `SyncHaltedBanner` — that one signals a *problem* (4xx, stuck
 * offline) and uses red/orange alarm styling. This one is purely
 * informational: the user did this on purpose, server + local data are
 * fine, and tapping "Resume sync" flushes whatever outbox built up
 * during the pause.
 *
 * Rendered inline on the Account screen rather than as a global
 * top-of-app banner because paused-sync is not an error condition that
 * needs to interrupt other surfaces — the indication just needs to be
 * findable when the user goes looking for it.
 */
export const SyncPausedBanner = () => {
  const { status, pendingCount, resume } = useSyncStatus();

  if (status !== "paused") return null;

  const summary =
    pendingCount > 0
      ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync.`
      : "Your data is safe on this device and on the cloud.";

  return (
    <View style={styles.banner}>
      <View style={styles.textRegion}>
        <Text style={styles.title}>Sync paused</Text>
        <Text style={styles.detail} numberOfLines={3}>
          Nothing is being sent to or pulled from the cloud right now. {summary}{" "}
          Tap Resume to start syncing again.
        </Text>
      </View>
      <Pressable
        style={styles.resumeButton}
        onPress={() => {
          void resume();
        }}
        accessibilityRole="button"
        accessibilityLabel="Resume sync"
      >
        <Text style={styles.resumeText}>Resume sync</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F4F7",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D0D5DD",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  textRegion: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "700",
  },
  detail: {
    color: "#475467",
    fontSize: 12,
    marginTop: 2,
  },
  resumeButton: {
    backgroundColor: "#101828",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resumeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
