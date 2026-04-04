import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useEffect, useState } from "react";
import {
  defaultValues,
  formRegularityValues,
  regularityLabels,
  type FormRegularity,
  type HabitFormData,
  type HabitFormProps,
  type ScheduleEntry,
} from "./shared";
import { AllDays } from "./days";
import { ScheduleEntrySummary } from "./ScheduleEntrySummary";
import { ScheduleEditorModal } from "./ScheduleEditorModal";
import { ErrorText } from "./ErrorText";
import { SaveButton } from "./SaveButton";

export const HabitForm = ({
  initialValues,
  onSubmit,
  onDelete,
}: HabitFormProps) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<HabitFormData>({
    defaultValues: { ...defaultValues, ...initialValues },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });
  const watchedRegularity = watch("regularity");
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isNewEntry, setIsNewEntry] = useState(false);

  useEffect(() => {
    if (initialValues) {
      reset({ ...defaultValues, ...initialValues });
      setIsNewEntry(false);
      setEditingIndex(-1);
    }
  }, [initialValues, reset]);

  const changeRegularity = (
    newValue: FormRegularity,
    onChange: (v: FormRegularity) => void,
  ) => {
    const prev = getValues("regularity");
    const schedules = getValues("schedules");
    const hadSchedules = prev === "scheduled" && schedules.length > 0;

    const apply = () => {
      onChange(newValue);
      setIsNewEntry(false);
      setEditingIndex(-1);
      if (newValue === "scheduled" && schedules.length === 0) {
        setValue("schedules", [{ hour: "9", minute: "00", days: AllDays }]);
      }
      if (hadSchedules && newValue !== "scheduled") {
        setValue("schedules", [{ hour: "9", minute: "00", days: AllDays }]);
      }
    };

    if (hadSchedules && newValue !== "scheduled") {
      Alert.alert(
        "Clear Schedules",
        "Changing regularity will clear your scheduled times. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", style: "destructive", onPress: apply },
        ],
      );
    } else {
      apply();
    }
  };

  const openEditor = (index: number) => setEditingIndex(index);

  const commitDraft = (data: ScheduleEntry) => {
    if (isNewEntry) {
      append(data);
    } else {
      setValue(`schedules.${editingIndex}.hour`, data.hour);
      setValue(`schedules.${editingIndex}.minute`, data.minute);
      setValue(`schedules.${editingIndex}.days`, data.days);
      setValue(`schedules.${editingIndex}.reminder`, data.reminder);
    }
    setIsNewEntry(false);
    setEditingIndex(-1);
  };

  const cancelDraft = () => {
    setIsNewEntry(false);
    setEditingIndex(-1);
  };

  const removeEntry = (index: number) => remove(index);

  const addEntry = () => {
    setIsNewEntry(true);
    setEditingIndex(fields.length);
  };

  const isFrequency = ["day", "week", "month"].includes(watchedRegularity);

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Controller
          control={control}
          name="title"
          rules={{ required: "Title is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="e.g. Exercise"
            />
          )}
        />
        {errors.title && <ErrorText>{errors.title.message}</ErrorText>}

        <Controller
          control={control}
          name="description"
          rules={{}}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                errors.description && styles.inputError,
              ]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="Describe the habit"
              multiline
              textAlignVertical="top"
            />
          )}
        />
        {errors.description && (
          <ErrorText>{errors.description.message}</ErrorText>
        )}

        <View style={styles.goalSection}>
          <Controller
            control={control}
            name="regularity"
            render={({ field: { onChange, value } }) => (
              <View style={styles.segmentedRow}>
                {formRegularityValues.map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.segmentButton,
                      value === r && styles.segmentButtonActive,
                    ]}
                    onPress={() => changeRegularity(r, onChange)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        value === r && styles.segmentTextActive,
                      ]}
                    >
                      {regularityLabels[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />

          {isFrequency && (
            <View style={styles.frequencyRow}>
              <Controller
                control={control}
                name="frequency"
                rules={{
                  validate: (v) => {
                    if (!isFrequency) return true;
                    const n = Number(v);
                    return (
                      (Number.isInteger(n) && n >= 1) || "Must be at least 1"
                    );
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      styles.frequencyInput,
                      errors.frequency && styles.inputError,
                    ]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                )}
              />
              <Text style={styles.frequencySuffix}>
                per {watchedRegularity}
              </Text>
            </View>
          )}

          {watchedRegularity === "scheduled" && (
            <>
              {fields.map((field, index) => (
                <ScheduleEntrySummary
                  key={field.id}
                  index={index}
                  watch={watch}
                  onEdit={() => openEditor(index)}
                />
              ))}
              <Pressable style={styles.addTimeButton} onPress={addEntry}>
                <Text style={styles.addTimeButtonText}>+ Add Time</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomButtons}>
        <SaveButton onPress={handleSubmit(onSubmit)} />

        {onDelete && (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Habit</Text>
          </Pressable>
        )}
      </View>

      {(editingIndex >= 0 || isNewEntry) && (
        <ScheduleEditorModal
          initialValues={
            isNewEntry
              ? { hour: "9", minute: "00", days: AllDays, reminder: true }
              : getValues(`schedules.${editingIndex}`)
          }
          isNew={isNewEntry}
          onCommit={commitDraft}
          onCancel={cancelDraft}
          canRemove={!isNewEntry && fields.length > 1}
          onRemove={() => {
            removeEntry(editingIndex);
            setIsNewEntry(false);
            setEditingIndex(-1);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 120,
  },
  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  frequencyInput: {
    width: 80,
  },
  frequencySuffix: {
    fontSize: 14,
    color: "#666",
  },
  inputError: {
    borderColor: "#ff3b30",
  },
  goalSection: {
    marginTop: 8,
    gap: 12,
  },
  segmentedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segmentButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  segmentTextActive: {
    color: "#fff",
  },
  bottomButtons: {
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ccc",
  },
  deleteButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff3b30",
  },
  deleteButtonText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },
  addTimeButton: {
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
  },
  addTimeButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
