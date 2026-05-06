import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { useSyncStatus } from "../infrastructure/syncStatus";

/**
 * Persistent banner shown whenever the sync pipeline is stuck — either
 * the dispatcher is halted on a 4xx (`status === "halted"`) or it's
 * been transient-offline with at least one event waiting to ship
 * (`status === "offline" && pendingCount > 0`). The latter case
 * matters because the only previous surface was a small grey "offline"
 * dot, which left users unaware that real local work was queued and
 * not reaching the server.
 *
 * The body deep-links to admin for detail; the Retry button calls
 * `resume()` directly, which clears any halt flag, flips failed rows
 * back to pending, and kicks a fresh run.
 */
export const SyncHaltedBanner = () => {
  const { status, pendingCount, lastError, resume } = useSyncStatus();
  const router = useRouter();
  const wasVisibleRef = useRef(false);

  const isHaltedNow = status === "halted";
  const isStuckOfflineNow = status === "offline" && pendingCount > 0;
  const isVisibleNow = isHaltedNow || isStuckOfflineNow;

  // Capture every visibility transition so a wrongly-shown banner can be
  // located in Sentry and correlated with the state-machine breadcrumbs
  // emitted by syncStatus.tsx.
  useEffect(() => {
    if (isVisibleNow && !wasVisibleRef.current) {
      Sentry.addBreadcrumb({
        category: "nag.sync",
        type: "info",
        level: "warning",
        message: "banner shown",
        data: {
          status,
          pendingCount,
          lastError,
          isHaltedNow,
          isStuckOfflineNow,
        },
      });
      Sentry.captureMessage("nag.sync.banner-shown", {
        level: "warning",
        contexts: {
          sync: {
            status,
            pendingCount,
            lastError,
            isHaltedNow,
            isStuckOfflineNow,
          },
        },
        tags: { area: "sync" },
      });
    } else if (!isVisibleNow && wasVisibleRef.current) {
      Sentry.addBreadcrumb({
        category: "nag.sync",
        type: "info",
        level: "info",
        message: "banner hidden",
        data: { status, pendingCount },
      });
    }
    wasVisibleRef.current = isVisibleNow;
  }, [
    isVisibleNow,
    status,
    pendingCount,
    lastError,
    isHaltedNow,
    isStuckOfflineNow,
  ]);

  // Pad the top with the safe-area inset so the banner doesn't get eaten
  // by the iOS notch / status bar. The wrapping View in _layout.tsx is a
  // plain flex container with no safe-area handling — we used to render
  // the banner up there and have it partially obscured.
  const insets = useSafeAreaInsets();

  const isHalted = isHaltedNow;
  const isStuckOffline = isStuckOfflineNow;
  if (!isHalted && !isStuckOffline) return null;

  const isAuth = !!lastError && /^(401|403)/.test(lastError);
  const title = isHalted
    ? isAuth
      ? "Can't connect to your account"
      : "Not syncing right now"
    : `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync`;
  const body = isHalted
    ? isAuth
      ? "Your check-ins are saved on this device but can't reach the server. Tap Retry, or tap the banner to see details."
      : "Your recent changes are safe on this device, but we can't sync them right now. Tap Retry to try again."
    : "Saved on this device but not yet sent to the server. Tap Retry to try now, or tap the banner for details.";

  return (
    <View
      style={[
        isHalted ? styles.bannerHalted : styles.bannerOffline,
        { paddingTop: insets.top + 10 },
      ]}
    >
      <Pressable
        style={styles.textRegion}
        onPress={() => router.push("/admin")}
        accessibilityRole="button"
        accessibilityLabel={`${title} — open details`}
      >
        <Text style={isHalted ? styles.titleHalted : styles.titleOffline}>
          {title}
        </Text>
        <Text
          style={isHalted ? styles.detailHalted : styles.detailOffline}
          numberOfLines={3}
        >
          {body}
        </Text>
      </Pressable>
      <Pressable
        style={isHalted ? styles.retryButtonHalted : styles.retryButtonOffline}
        onPress={() => {
          Sentry.captureMessage("nag.sync.retry-tapped", {
            level: "info",
            contexts: { sync: { status, pendingCount, lastError } },
            tags: { area: "sync" },
          });
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
  bannerHalted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#B42318",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerOffline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF6E7",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#B54708",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textRegion: {
    flex: 1,
    paddingRight: 12,
  },
  titleHalted: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "700",
  },
  titleOffline: {
    color: "#B54708",
    fontSize: 14,
    fontWeight: "700",
  },
  detailHalted: {
    color: "#B42318",
    fontSize: 12,
    marginTop: 2,
  },
  detailOffline: {
    color: "#B54708",
    fontSize: 12,
    marginTop: 2,
  },
  retryButtonHalted: {
    backgroundColor: "#B42318",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonOffline: {
    backgroundColor: "#B54708",
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
