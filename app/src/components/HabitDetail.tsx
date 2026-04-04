import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { format } from "date-fns";

interface CheckIn {
  id: number;
  timestamp: Date;
  skipped: boolean | null;
}

export interface HabitDetailProps {
  loading?: boolean;
  title: string;
  description: string | null;
  goalText: string | null;
  checkIns: CheckIn[];
  showSkip: boolean;
  onCheckIn: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onRemoveCheckIn: (checkInId: number) => void;
}

export const HabitDetail = ({
  loading,
  title,
  description,
  goalText,
  checkIns,
  showSkip,
  onCheckIn,
  onSkip,
  onEdit,
  onRemoveCheckIn,
}: HabitDetailProps) => {
  const handleRemove = (checkInId: number) => {
    Alert.alert("Remove Check-in", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onRemoveCheckIn(checkInId),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {goalText && <Text style={styles.goal}>Goal: {goalText}</Text>}

      <FlatList
        data={checkIns}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No check-ins yet</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.timestamp}>
                {format(item.timestamp, "EEE, MMM d, yyyy h:mm a")}
              </Text>
              {item.skipped && (
                <Text style={styles.skippedLabel}>(skipped)</Text>
              )}
            </View>
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
        <Pressable style={styles.checkInButton} onPress={onCheckIn}>
          <Text style={styles.checkInButtonText}>Check-in</Text>
        </Pressable>
        {showSkip && (
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        )}
        <Pressable style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
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
  skipButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#FF9500",
  },
  skipButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skippedLabel: {
    fontSize: 12,
    color: "#FF9500",
    fontWeight: "600",
    marginTop: 2,
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
