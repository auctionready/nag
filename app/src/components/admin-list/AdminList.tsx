import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface Habit {
  id: string;
  title: string;
  description: string | null;
}

export interface AdminListProps {
  habits: Habit[];
  onAddHabit: () => void;
  onEditHabit: (id: string) => void;
}

export const AdminList = ({
  habits,
  onAddHabit,
  onEditHabit,
}: AdminListProps) => {
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
            <Pressable
              style={styles.editButton}
              onPress={() => onEditHabit(item.id)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No habits yet. Add one!</Text>
        }
        contentContainerStyle={styles.list}
      />
      <Pressable style={styles.addButton} onPress={onAddHabit}>
        <Text style={styles.addButtonText}>+ Add Habit</Text>
      </Pressable>
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
