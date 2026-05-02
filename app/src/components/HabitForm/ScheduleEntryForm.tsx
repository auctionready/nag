import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { tokens } from "../theme";
import { timeFromStrings, type ScheduleEntry } from "./shared";
import { NoDays } from "@nag/core";
import { ErrorText } from "./ErrorText";
import { WeekdayPills } from "./WeekdayPills";

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

  const days = watch("days") ?? NoDays;
  const hour = watch("hour");
  const minute = watch("minute");

  const timeValue = useMemo(
    () => timeFromStrings(hour, minute),
    [hour, minute],
  );

  const toggleDay = (day: number) => {
    const newDays = days ^ day;
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
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>days</Text>
        <WeekdayPills days={days} onToggle={toggleDay} size="md" />
        {errors.days && <ErrorText>{errors.days.message}</ErrorText>}
      </View>

      <View style={styles.divider} />

      <View style={styles.timeSection}>
        <Text style={styles.fieldLabel}>time</Text>
        <DateTimePicker
          value={timeValue}
          mode="time"
          display="spinner"
          onChange={onTimeChange}
          style={styles.timePicker}
        />
      </View>

      <View style={styles.divider} />

      <Controller
        control={control}
        name="reminder"
        render={({ field: { value, onChange } }) => (
          <View style={styles.reminderRow}>
            <View style={styles.reminderText}>
              <Text style={styles.reminderLabel}>reminder</Text>
              <Text style={styles.reminderSub}>
                push notification at this time
              </Text>
            </View>
            <Switch
              value={value !== false}
              onValueChange={onChange}
              trackColor={{ false: tokens.faint, true: tokens.orange }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}
      />

      <View style={styles.actions}>
        {canRemove ? (
          <Pressable
            style={styles.removeButton}
            onPress={onRemove}
            accessibilityRole="button"
          >
            <Text style={styles.removeText}>remove</Text>
          </Pressable>
        ) : (
          <View style={styles.removeSpacer} />
        )}
        <View style={styles.actionsRight}>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.doneButton,
              (!isValid || (!isNew && !isDirty)) && styles.doneButtonDisabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || (!isNew && !isDirty)}
          >
            <Text style={styles.doneButtonText}>done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  section: {
    gap: 8,
    paddingHorizontal: 4,
  },
  fieldLabel: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.border,
    marginVertical: 16,
  },
  timeSection: {
    gap: 4,
    paddingHorizontal: 4,
  },
  timePicker: {
    height: 150,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  reminderText: {
    flex: 1,
    gap: 2,
  },
  reminderLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
  },
  reminderSub: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  removeSpacer: {
    width: 1,
  },
  removeText: {
    color: tokens.orange,
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRight: {
    flexDirection: "row",
    gap: 6,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  cancelButtonText: {
    color: tokens.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  doneButton: {
    backgroundColor: tokens.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  doneButtonDisabled: {
    opacity: 0.4,
  },
  doneButtonText: {
    color: tokens.cream,
    fontSize: 13,
    fontWeight: "600",
  },
});
