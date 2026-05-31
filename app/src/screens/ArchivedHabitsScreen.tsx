import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { archivedHabits } from "@nag/core";
import { tokens } from "../components/theme";
import { Group, Row } from "../components/account/AccountUI";

/**
 * Accounts → Archived Habits. Lists every archived habit; tapping one
 * opens its detail page (from which the edit screen's hamburger menu
 * offers Unarchive).
 */
export const ArchivedHabitsScreen = () => {
  const { data: habits } = useLiveQuery(archivedHabits(db));

  if (!habits) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {habits.length === 0 ? (
        <Text style={styles.empty}>No archived habits.</Text>
      ) : (
        <Group title="Archived">
          {habits.map((habit, i) => (
            <Row
              key={habit.id}
              label={habit.title}
              detail={habit.description ?? undefined}
              onPress={() => router.push(`/habit/${habit.id}`)}
              last={i === habits.length - 1}
            />
          ))}
        </Group>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  empty: {
    textAlign: "center",
    color: tokens.mute,
    marginTop: 48,
    fontSize: 15,
  },
});
