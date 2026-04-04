import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { timeFromStrings, type ScheduleEntry } from "./shared";
import { NoDays, weekDayEntries } from "@nag/core";
import { ErrorText } from "./ErrorText";
import { RemoveButton } from "./RemoveButton";

interface ScheduleEntryFormProps {
  initialValues: ScheduleEntry;
  isNew: boolean;
  onSubmit: (data: ScheduleEntry) => void;
  onCancel: () => void;
  canRemove: boolean;
  onRemove: () => void;
}

export const ScheduleEntryForm = ({
  initialValues,
  isNew,
  onSubmit,
  onCancel,
  canRemove,
  onRemove,
}: ScheduleEntryFormProps) => {
  const {
    control,
    handleSubmit,
    register,
    setValue,
    watch,
    trigger,
    formState: { isValid, isDirty, errors },
  } = useForm<ScheduleEntry>({
    defaultValues: initialValues,
    mode: "onChange",
  });

  register("days", {
    validate: (v) => (!!v && v !== NoDays) || "Select at least one day",
  });
  register("hour");
  register("minute");

  useEffect(() => {
    void trigger("days");
  }, [trigger]);

  const days = watch("days");
  const hour = watch("hour");
  const minute = watch("minute");

  const timeValue = useMemo(
    () => timeFromStrings(hour, minute),
    [hour, minute],
  );

  const toggleDay = (day: number) => {
    const newDays = (days ?? NoDays) ^ day;
    setValue("days", newDays, { shouldDirty: true, shouldValidate: true });
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) return;
    setValue("hour", String(date.getHours()), { shouldDirty: true });
    setValue("minute", String(date.getMinutes()).padStart(2, "0"), {
      shouldDirty: true,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.daysRow}>
        {weekDayEntries.map(({ day, label }) => {
          const checked = (days ?? NoDays) & day;
          return (
            <Pressable
              key={day}
              style={[styles.dayTile, checked ? styles.dayTileActive : null]}
              onPress={() => toggleDay(day)}
            >
              <Text
                style={[
                  styles.dayTileText,
                  checked ? styles.dayTileTextActive : null,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errors.days && <ErrorText>{errors.days.message}</ErrorText>}

      <Controller
        control={control}
        name="reminder"
        render={({ field: { value, onChange } }) => (
          <View style={styles.reminderRow}>
            <Text style={styles.reminderLabel}>Reminder</Text>
            <Switch value={value !== false} onValueChange={onChange} />
          </View>
        )}
      />

      <DateTimePicker
        value={timeValue}
        mode="time"
        display="spinner"
        onChange={onTimeChange}
        style={styles.timePicker}
      />

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.doneButton,
            (!isValid || (!isNew && !isDirty)) && styles.doneButtonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || (!isNew && !isDirty)}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        {canRemove && (
          <View style={{ marginLeft: "auto" }}>
            <RemoveButton onPress={onRemove} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timePicker: {
    height: 150,
  },
  doneButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  doneButtonDisabled: {
    opacity: 0.4,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderLabel: {
    fontSize: 15,
    color: "#333",
  },
  daysRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayTile: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  dayTileActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayTileText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  dayTileTextActive: {
    color: "#fff",
  },
});
