import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSyncStatus } from "../infrastructure/syncStatus";

/**
 * Persistent banner shown only while the dispatcher is halted on a
 * non-retriable 4xx. Surfaces the server's error text directly and
 * exposes a one-tap Retry (calls `resume()`) so the user doesn't have
 * to navigate to admin for the common case. Tapping the body still
 * deep-links to admin for full inspection / manual fixing.
 */
export const SyncHaltedBanner = () => {
  const { status, lastError, resume } = useSyncStatus();
  const router = useRouter();

  if (status !== "halted") return null;

  const isAuth = !!lastError && /^(401|403)/.test(lastError);
  const title = isAuth ? "Sync paused — auth failed" : "Sync paused";

  return (
    <View style={styles.banner}>
      <Pressable
        style={styles.textRegion}
        onPress={() => router.push("/admin")}
        accessibilityRole="button"
        accessibilityLabel="Sync paused — open admin"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail} numberOfLines={3}>
          {lastError ?? "A command could not be synced. Tap for details."}
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
