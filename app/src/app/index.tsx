import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { habit } from "@nag/schema";

export default function BoardScreen() {
  const { data: habits } = useLiveQuery(db.select().from(habit));

  if (!habits?.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>You have no habits set</Text>
        <Link href="/add-habit" asChild>
          <Pressable style={styles.createButton}>
            <Text style={styles.createButtonText}>Create Habit</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {habits.map((item) => (
          <View key={item.id} style={styles.tileWrapper}>
            <View style={styles.tile}>
              <Text style={styles.tileTitle}>{item.title}</Text>
            </View>
          </View>
        ))}
        <View style={styles.addTileWrapper}>
          <Link href="/add-habit" asChild>
            <Pressable style={styles.addTile}>
              <Text style={styles.addTileText}>+ Add Habit</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  tileWrapper: {
    width: "50%",
    aspectRatio: 1,
    padding: 4,
  },
  tile: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#fff",
  },
  addTileWrapper: {
    width: "50%",
    aspectRatio: 1,
    padding: 4,
  },
  addTile: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  addTileText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
