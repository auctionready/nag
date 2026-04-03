import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";

export const AdminScreen = () => {
  const { data: habits } = useLiveQuery(allHabits(db));

  return (
    <View style={styles.container}>
      <FlatList
        data={habits}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.habitRow}>
            <View style={styles.habitInfo}>
              <Text style={styles.habitTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.habitDescription}>{item.description}</Text>
              ) : null}
            </View>
            <Link href={`/edit-habit/${item.id}`} asChild>
              <Pressable style={styles.editButton}>
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>
            </Link>
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
};

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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  habitInfo: {
    flex: 1,
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
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
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
