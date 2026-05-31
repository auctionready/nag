import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Control, FieldArrayWithId } from "react-hook-form";
import { tokens } from "../theme";
import { ScheduleEntrySummary } from "./ScheduleEntrySummary";
import { type HabitFormData, type ScheduleEntry } from "./shared";

interface ScheduledListProps {
  fields: FieldArrayWithId<HabitFormData, "schedules", "id">[];
  schedules: ScheduleEntry[] | undefined;
  control: Control<HabitFormData>;
  onEdit: (index: number) => void;
  onAdd: () => void;
}

const minutesOf = (s: ScheduleEntry | undefined): number =>
  (Number(s?.hour) || 0) * 60 + (Number(s?.minute) || 0);

// List of time-time-slot summary rows, ordered chronologically, with a dashed
// "add time" button at the foot.
export const ScheduledList = ({
  fields,
  schedules,
  control,
  onEdit,
  onAdd,
}: ScheduledListProps) => (
  <View style={styles.list}>
    {fields
      .map((field, index) => ({ field, index }))
      .sort(
        (a, b) =>
          minutesOf(schedules?.[a.index]) - minutesOf(schedules?.[b.index]),
      )
      .map(({ field, index }) => (
        <ScheduleEntrySummary
          key={field.id}
          index={index}
          control={control}
          onEdit={() => onEdit(index)}
        />
      ))}
    <Pressable style={styles.addButton} onPress={onAdd}>
      <Text style={styles.plus}>+</Text>
      <Text style={styles.addText}>add time</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.faint,
    paddingVertical: 13,
  },
  plus: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.ink,
    lineHeight: 18,
  },
  addText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.1,
  },
});
