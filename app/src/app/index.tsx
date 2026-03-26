import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { habit } from "@nag/schema";

export default function HomeScreen() {
  const { data: habits } = useLiveQuery(db.select().from(habit));

  return (
    <View style={styles.container}>
      <FlatList
        data={habits}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.habitRow}>
            <Text style={styles.habitTitle}>{item.title}</Text>
            <Text style={styles.habitDescription}>{item.description}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No habits yet. Add one!</Text>
        }
        contentContainerStyle={styles.list}
      />
      <Link href="/add-habit" asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Habit</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  habitRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  habitTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  habitDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#007AFF",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
