import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";
import { AdminList } from "../components/AdminList";
import { SyncStatusPanel } from "../components/SyncStatusPanel";
import { isClerkConfigured } from "../infrastructure/clerk";

const AdminScreen = () => {
  const router = useRouter();
  const { data: habits } = useLiveQuery(allHabits(db));

  return (
    <View style={styles.container}>
      <SyncStatusPanel />
      {isClerkConfigured() ? (
        <Pressable
          style={styles.accountRow}
          onPress={() => router.push("/account")}
          accessibilityRole="button"
        >
          <Text style={styles.accountRowText}>Account & sign-in</Text>
          <Text style={styles.accountRowChevron}>›</Text>
        </Pressable>
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
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  accountRowText: {
    fontSize: 16,
    color: "#222",
  },
  accountRowChevron: {
    fontSize: 22,
    color: "#999",
  },
});
