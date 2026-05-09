import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../../components/theme";
import { AddTile } from "./AddTile";
import { EmptyBoard } from "./EmptyBoard";
import { Header } from "./Header";
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
  const { percent, line, suffix } = useBoardProgress(habitIds);

  if (!habits.length) {
    return <EmptyBoard onAddHabit={onAddHabit} />;
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
        <Header percent={percent} line={line} suffix={suffix} />
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  cell: {
    width: "50%",
    padding: 5,
  },
});
