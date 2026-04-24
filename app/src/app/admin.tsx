import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";
import { AdminList } from "../components/AdminList";
import { useSyncStatus } from "../infrastructure/syncStatus";

const AdminScreen = () => {
  const router = useRouter();
  const { data: habits } = useLiveQuery(allHabits(db));
  const { status, pendingCount, failedCount, lastError, resume } =
    useSyncStatus();

  const showResume = status === "halted";

  return (
    <View style={styles.container}>
      {status !== "disabled" ? (
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
      ) : null}
      <AdminList
        habits={habits ?? []}
        onAddHabit={() => router.push("/add-habit")}
        onEditHabit={(id) => router.push(`/edit-habit/${id}`)}
      />
    </View>
  );
};

export default AdminScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
