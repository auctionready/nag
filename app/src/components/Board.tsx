import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

interface Habit {
  id: number;
  title: string;
}

export interface BoardProps {
  habits: Habit[];
  onAddHabit: () => void;
  renderTile: (habit: Habit) => React.ReactNode;
}

export const Board = ({ habits, onAddHabit, renderTile }: BoardProps) => {
  if (!habits.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>You have no habits set</Text>
        <Pressable style={styles.createButton} onPress={onAddHabit}>
          <Text style={styles.createButtonText}>Create Habit</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.grid}>
      {habits.map((item) => (
        <View key={item.id} style={styles.tileWrapper}>
          {renderTile(item)}
        </View>
      ))}
      <View style={styles.addTileWrapper}>
        <Pressable style={styles.addTile} onPress={onAddHabit}>
          <Text style={styles.addTileText}>+ Add Habit</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

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
