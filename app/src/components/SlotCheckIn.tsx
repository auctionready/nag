import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export interface SlotCheckInItem {
  id: number;
  title: string;
  checkedIn: boolean;
  skipped: boolean;
}

export interface SlotCheckInProps {
  habits: SlotCheckInItem[];
  onCheckIn: (habitId: number) => void;
  onSkip: (habitId: number) => void;
  onDone: () => void;
}

export const SlotCheckIn = ({
  habits,
  onCheckIn,
  onSkip,
  onDone,
}: SlotCheckInProps) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={habits}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const actioned = item.checkedIn || item.skipped;
          return (
            <View style={[styles.row, actioned && styles.rowActioned]}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, actioned && styles.titleActioned]}>
                  {item.title}
                </Text>
                {item.checkedIn && <Text style={styles.doneLabel}>Done</Text>}
                {item.skipped && (
                  <Text style={styles.skippedLabel}>Skipped</Text>
                )}
              </View>
              {!actioned && (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.checkInButton}
                    onPress={() => onCheckIn(item.id)}
                  >
                    <Text style={styles.checkInButtonText}>Check-in</Text>
                  </Pressable>
                  <Pressable
                    style={styles.skipButton}
                    onPress={() => onSkip(item.id)}
                  >
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
      <Pressable style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowActioned: {
    opacity: 0.6,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
  },
  titleActioned: {
    color: "#999",
  },
  doneLabel: {
    fontSize: 13,
    color: "#34C759",
    fontWeight: "600",
    marginTop: 2,
  },
  skippedLabel: {
    fontSize: 13,
    color: "#FF9500",
    fontWeight: "600",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  checkInButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  checkInButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  skipButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  skipButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  doneButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
