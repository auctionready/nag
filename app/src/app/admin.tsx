import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";
import { AdminList } from "../components/AdminList";
import { SyncStatusPanel } from "../components/SyncStatusPanel";

const AdminScreen = () => {
  const router = useRouter();
  const { data: habits } = useLiveQuery(allHabits(db));

  return (
    <View style={styles.container}>
      <SyncStatusPanel />
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
});
