import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../../../../components/theme";
import { useBoardProgress } from "./useBoardProgress";

interface Habit {
  id: string;
  title: string;
}

export interface BoardProps {
  habits: Habit[];
  onAddHabit: () => void;
  renderTile: (habit: Habit) => React.ReactNode;
}

export const Board = ({ habits, onAddHabit, renderTile }: BoardProps) => {
  const insets = useSafeAreaInsets();
  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);
  const { percent, line } = useBoardProgress(habitIds);

  if (!habits.length) {
    return (
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
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header percent={percent} line={line} />
        <View style={styles.grid}>
          {habits.map((item) => (
            <View key={item.id} style={styles.cell}>
              {renderTile(item)}
            </View>
          ))}
          <View style={styles.cell}>
            <AddTile onPress={onAddHabit} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const Header = ({ percent, line }: { percent: number; line: string }) => (
  <View style={styles.header}>
    <View style={styles.headerRow}>
      <Text style={styles.percent}>{percent}</Text>
      <Text style={styles.percentSuffix}>% today</Text>
    </View>
    <Text style={styles.headerLine}>{line}</Text>
  </View>
);

const AddTile = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
  >
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 2v10M2 7h10"
        stroke={tokens.mute}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
    <Text style={styles.addTileText}>add habit</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  percent: {
    fontSize: 40,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -1.6,
    lineHeight: 40,
  },
  percentSuffix: {
    fontSize: 22,
    fontWeight: "500",
    color: tokens.mute,
    marginLeft: 4,
    letterSpacing: -0.5,
  },
  headerLine: {
    fontFamily: "JetBrainsMono",
    fontSize: 11.5,
    color: tokens.mute,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  cell: {
    width: "50%",
    padding: 5,
  },
  addTile: {
    minHeight: 156,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: tokens.faint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  addTileText: {
    color: tokens.mute,
    fontSize: 14,
    fontWeight: "500",
  },
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
