import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSyncStatus } from "../infrastructure/syncStatus";

/**
 * Persistent banner shown only while the dispatcher is halted on a
 * non-retriable 4xx. Deep-links to the admin screen where the user can
 * inspect the failing command and press "Resume sync".
 */
export const SyncHaltedBanner = () => {
  const { status, lastError } = useSyncStatus();
  const router = useRouter();

  if (status !== "halted") return null;

  return (
    <Pressable
      style={styles.banner}
      onPress={() => router.push("/admin")}
      accessibilityRole="button"
      accessibilityLabel="Sync paused — open admin"
    >
      <Text style={styles.title}>Sync paused</Text>
      <Text style={styles.detail} numberOfLines={2}>
        {lastError ?? "A command could not be synced. Tap for details."}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FDECEC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#B42318",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "700",
  },
  detail: {
    color: "#B42318",
    fontSize: 12,
    marginTop: 2,
  },
});
