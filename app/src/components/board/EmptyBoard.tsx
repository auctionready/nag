import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";

export interface EmptyBoardProps {
  onAddHabit: () => void;
}

export const EmptyBoard = ({ onAddHabit }: EmptyBoardProps) => (
  <View style={styles.empty}>
    <View style={styles.emptyBody}>
      <Text style={styles.emptyTitle}>nothing to nag yet.</Text>
      <Text style={styles.emptySubtitle}>
        set up your first habit and we&apos;ll start nudging.
      </Text>
      <Pressable style={styles.createButton} onPress={onAddHabit}>
        <Text style={styles.createButtonText}>Create Habit</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  emptyBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: tokens.mute,
    textAlign: "center",
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: tokens.ink,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  createButtonText: {
    color: tokens.cream,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
