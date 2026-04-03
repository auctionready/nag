import { Pressable, StyleSheet, Text, View } from "react-native";
import type { UseFormWatch } from "react-hook-form";
import { formatDays, formatTime, type HabitFormData } from "./shared";

export function ScheduleEntrySummary({
  index,
  watch,
  onEdit,
}: {
  index: number;
  watch: UseFormWatch<HabitFormData>;
  onEdit: () => void;
}) {
  const hour = watch(`schedules.${index}.hour`);
  const minute = watch(`schedules.${index}.minute`);
  const days = watch(`schedules.${index}.days`) ?? 0;

  return (
    <View style={styles.row}>
      <Pressable style={styles.content} onPress={onEdit}>
        <Text style={styles.text}>
          {formatDays(days)} · {formatTime(hour, minute)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 15,
    color: "#333",
  },
});
