import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../../../db";
import { habitById, goalForHabitFull, schedulesForHabit } from "@nag/core";
import { tokens } from "../../../components/theme";
import { DetailHeader } from "../../../components/habit-detail/DetailHeader";
import { cadenceSummary } from "../../../components/habit-detail/cadenceSummary";
import { use24HourClock } from "../../../infrastructure/preferences";
import { HabitHistoryView } from "../../../components/habit-history";

const HabitHistoryScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const habitId = id ?? "";

  const { data: habits } = useLiveQuery(habitById(db, habitId), [habitId]);
  const habitData = habits?.[0];

  const { data: goals } = useLiveQuery(goalForHabitFull(db, habitId), [
    habitId,
  ]);
  const goalData = goals?.[0];

  const { data: scheduleRows } = useLiveQuery(schedulesForHabit(db, habitId), [
    habitId,
  ]);
  const schedules = scheduleRows ?? [];

  const clock24 = use24HourClock();
  const summary = cadenceSummary({
    regularity: goalData?.regularity ?? null,
    frequency: goalData?.frequency ?? null,
    schedules,
    clock24,
  });

  return (
    <View style={styles.container}>
      <DetailHeader
        title="history"
        onBack={() => router.back()}
        showHistory={false}
        showEdit={false}
      />
      {habitData?.id && (
        <HabitHistoryView
          habitExternalId={habitData.id}
          title={habitData.title}
          icon={habitData.icon ?? null}
          cadenceSummary={summary}
        />
      )}
    </View>
  );
};

export default HabitHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
});
