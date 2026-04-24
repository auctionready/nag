import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSyncStatus } from "../infrastructure/syncStatus";

/**
 * Persistent banner shown only while the dispatcher is halted on a
 * non-retriable 4xx. The copy is user-facing, focused on impact +
 * action (not technical cause). Tapping the body deep-links to admin
 * for detail; the Retry button calls `resume()` directly.
 */
export const SyncHaltedBanner = () => {
  const { status, lastError, resume } = useSyncStatus();
  const router = useRouter();

  if (status !== "halted") return null;

  const isAuth = !!lastError && /^(401|403)/.test(lastError);
  const title = isAuth
    ? "Can't connect to your account"
    : "Not syncing right now";
  const body = isAuth
    ? "Your check-ins are saved on this device but can't reach the server. Tap Retry, or tap the banner to see details."
    : "Your recent changes are safe on this device, but we can't sync them right now. Tap Retry to try again.";

  return (
    <View style={styles.banner}>
      <Pressable
        style={styles.textRegion}
        onPress={() => router.push("/admin")}
        accessibilityRole="button"
        accessibilityLabel={`${title} — open details`}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail} numberOfLines={3}>
          {body}
        </Text>
      </Pressable>
      <Pressable
        style={styles.retryButton}
        onPress={() => {
          void resume();
        }}
        accessibilityRole="button"
        accessibilityLabel="Retry sync"
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#B42318",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textRegion: {
    flex: 1,
    paddingRight: 12,
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
  retryButton: {
    backgroundColor: "#B42318",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
