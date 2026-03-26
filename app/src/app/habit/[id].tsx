import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "../../db";
import { checkIn, habit, goal, getTitle } from "@nag/schema";

export default function HabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const habitId = Number(id);

  const { data: habits } = useLiveQuery(
    db.select().from(habit).where(eq(habit.id, habitId)),
  );
  const habitData = habits?.[0];

  const { data: goals } = useLiveQuery(
    db.select().from(goal).where(eq(goal.habitId, habitId)),
  );
  const goalData = goals?.[0];

  const { data: checkIns } = useLiveQuery(
    db
      .select()
      .from(checkIn)
      .where(eq(checkIn.habitId, habitId))
      .orderBy(desc(checkIn.timestamp)),
  );

  const handleRemove = (checkInId: number) => {
    Alert.alert("Remove Check-in", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await db.delete(checkIn).where(eq(checkIn.id, checkInId));
        },
      },
    ]);
  };

  if (!habitData) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const goalText = goalData ? getTitle(goalData) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{habitData.title}</Text>
      {habitData.description && (
        <Text style={styles.description}>{habitData.description}</Text>
      )}
      {goalText && <Text style={styles.goal}>Goal: {goalText}</Text>}

      <FlatList
        data={checkIns}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No check-ins yet</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.timestamp}>
              {format(new Date(item.timestamp), "EEE, MMM d, yyyy h:mm a")}
            </Text>
            <Pressable
              onPress={() => handleRemove(item.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={styles.checkInButton}
          onPress={async () => {
            await db.insert(checkIn).values({ habitId });
          }}
        >
          <Text style={styles.checkInButtonText}>Check-in</Text>
        </Pressable>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(`/edit-habit/${habitId}`)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
    color: "#666",
    marginBottom: 4,
  },
  goal: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  timestamp: {
    fontSize: 15,
    color: "#333",
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ff3b30",
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 16,
  },
  checkInButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  checkInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  editButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  editButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
