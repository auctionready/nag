import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { format } from "date-fns";
import Svg, { Path } from "react-native-svg";
import { getTitle } from "@nag/schema";
import { archivedHabits, goalsForHabits } from "@nag/core";
import { db } from "../db";
import { tokens } from "../components/theme";
import { HabitGlyph, type HabitIconKind } from "../components/glyphs";

/**
 * Accounts → Archived Habits. Lists every archived habit (newest first);
 * tapping one opens its detail page, from which the edit screen's menu
 * offers Unarchive.
 */
export const ArchivedHabitsScreen = () => {
  const { data: habits } = useLiveQuery(archivedHabits(db));
  const ids = useMemo(() => (habits ?? []).map((h) => h.id), [habits]);
  const { data: goals } = useLiveQuery(goalsForHabits(db, ids), [
    ids.join(","),
  ]);

  const cadenceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals ?? []) {
      map.set(
        g.habitId,
        getTitle({ frequency: g.frequency, regularity: g.regularity }),
      );
    }
    return map;
  }, [goals]);

  if (!habits) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Archived</Text>
        <Text style={styles.subtitle}>off your board · history kept</Text>
      </View>

      {habits.length === 0 ? (
        <Text style={styles.empty}>No archived habits.</Text>
      ) : (
        <View style={styles.card}>
          {habits.map((habit, i) => {
            const cadence = cadenceById.get(habit.id);
            const when = habit.archivedAt
              ? `archived ${format(habit.archivedAt, "d MMM")}`
              : "archived";
            return (
              <Pressable
                key={habit.id}
                onPress={() => router.push(`/habit/${habit.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorder,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.badge}>
                  <HabitGlyph
                    kind={habit.icon as HabitIconKind | null}
                    size={18}
                    color={tokens.ink}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {habit.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {cadence ? `${cadence} · ${when}` : when}
                  </Text>
                </View>
                <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
                  <Path
                    d="M1 1l4 4.5L1 10"
                    stroke={tokens.mute}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            );
          })}
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
};

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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border,
  },
  rowPressed: {
    backgroundColor: tokens.inkTint,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.14,
  },
  rowMeta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
    marginTop: 3,
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
