import { ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { ArchivedHabitItem } from "./ArchivedHabitItem";

export interface ArchivedHabit {
  id: string;
  title: string;
  icon: string | null;
  /** Mono caption, e.g. "daily · archived 12 Apr". */
  meta: string;
}

export interface ArchivedHabitsListProps {
  habits: ArchivedHabit[];
  onOpen: (id: string) => void;
}

/**
 * Dumb archived-habits view: title block, a grouped card of
 * {@link ArchivedHabitItem} rows, and a closing hint. The smart screen
 * supplies the already-formatted rows and the open handler.
 */
export const ArchivedHabitsList = ({
  habits,
  onOpen,
}: ArchivedHabitsListProps) => (
  <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
    <View style={styles.titleBlock}>
      <Text style={styles.title}>Archived</Text>
      <Text style={styles.subtitle}>off your board · history kept</Text>
    </View>

    {habits.length === 0 ? (
      <Text style={styles.empty}>No archived habits.</Text>
    ) : (
      <View style={styles.card}>
        {habits.map((habit, i) => (
          <ArchivedHabitItem
            key={habit.id}
            title={habit.title}
            icon={habit.icon}
            meta={habit.meta}
            withDivider={i > 0}
            onPress={() => onOpen(habit.id)}
          />
        ))}
      </View>
    )}

    {habits.length > 0 && (
      <Text style={styles.hint}>
        Open a habit to view its record. To bring it back, hit the menu on its
        edit screen and choose <Text style={styles.hintInk}>unarchive</Text>.
      </Text>
    )}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  content: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  title: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 28,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.84,
  },
  subtitle: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
    letterSpacing: 0.44,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: "hidden",
  },
  empty: {
    textAlign: "center",
    color: tokens.mute,
    marginTop: 48,
    fontSize: 15,
  },
  hint: {
    paddingHorizontal: 24,
    paddingTop: 12,
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
    lineHeight: 16,
  },
  hintInk: {
    color: tokens.ink,
  },
});
