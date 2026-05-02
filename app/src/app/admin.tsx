import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits, clearWholeDevice } from "@nag/core";
import { AdminList } from "../components/AdminList";
import { SyncStatusPanel } from "../components/SyncStatusPanel";
import { useSyncStatus } from "../infrastructure/syncStatus";
import { deviceTokenStore } from "../infrastructure/tokenStore";
import { log } from "../infrastructure/log";

const logger = log("admin");

const AdminScreen = () => {
  const router = useRouter();
  const { kickSync } = useSyncStatus();
  const { data: habits } = useLiveQuery(allHabits(db));

  const onClearWholeDevice = () => {
    Alert.alert(
      "Clear whole device?",
      "Wipes all habits, check-ins, the outbox, and the device identity. " +
        "Equivalent to a clean reinstall — server data is untouched. This " +
        "can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear device",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await clearWholeDevice({ db, tokenStore: deviceTokenStore });
                logger.info("device wiped via admin tool");
                // Nudge the sync provider so the dot re-evaluates
                // isAnonymous off the now-empty identity row.
                kickSync("post-clear-device");
              } catch (err) {
                logger.error("clearWholeDevice failed", err);
                Alert.alert(
                  "Clear failed",
                  err instanceof Error ? err.message : String(err),
                );
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <View style={styles.container}>
      <SyncStatusPanel />
      <AdminList
        habits={habits ?? []}
        onAddHabit={() => router.push("/add-habit")}
        onEditHabit={(id) => router.push(`/edit-habit/${id}`)}
      />
      <Pressable
        style={styles.dangerButton}
        onPress={onClearWholeDevice}
        accessibilityRole="button"
      >
        <Text style={styles.dangerButtonText}>Clear whole device</Text>
      </Pressable>
    </View>
  );
};

export default AdminScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  dangerButton: {
    backgroundColor: "#B42318",
    margin: 16,
    marginTop: 0,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
