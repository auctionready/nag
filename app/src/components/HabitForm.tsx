import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Regularity } from "@nag/schema";

type FormRegularity = Regularity | "none" | "scheduled";

type ScheduleEntry = {
  hour: string;
  minute: string;
  days?: number;
};

export type HabitFormData = {
  title: string;
  description: string;
  regularity: FormRegularity;
  frequency: string;
  schedules: ScheduleEntry[];
};

export interface HabitFormProps {
  initialValues?: Partial<HabitFormData>;
  onSubmit: (data: HabitFormData) => Promise<void>;
  onDelete?: () => void;
}

const defaultValues: HabitFormData = {
  title: "",
  description: "",
  regularity: "none",
  frequency: "1",
  schedules: [{ hour: "9", minute: "00", days: 127 }],
};

const formRegularityValues: FormRegularity[] = [
  "none",
  "day",
  "week",
  "month",
  "scheduled",
];
const regularityLabels: Record<FormRegularity, string> = {
  none: "Ad-hoc",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  scheduled: "Scheduled",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeFromStrings(hour: string, minute: string): Date {
  const d = new Date();
  d.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
  return d;
}

function formatTime(hour: string, minute: string): string {
  const h = Number(hour) || 9;
  const m = String(Number(minute) || 0).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

function formatDays(days: number): string {
  if (days === 0) return "No days";
  if (days === 127) return "Every day";
  const selected: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (days & (1 << i)) selected.push(dayLabels[i]);
  }
  return selected.join(", ");
}

export function HabitForm({
  initialValues,
  onSubmit,
  onDelete,
}: HabitFormProps) {
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
  const [draft, setDraft] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    if (initialValues) {
      reset({ ...defaultValues, ...initialValues });
      setEditingIndex(-1);
      setDraft(null);
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
      setEditingIndex(-1);
      setDraft(null);
      if (newValue === "scheduled" && schedules.length === 0) {
        setValue("schedules", [{ hour: "9", minute: "00", days: 127 }]);
      }
      if (hadSchedules && newValue !== "scheduled") {
        setValue("schedules", [{ hour: "9", minute: "00", days: 127 }]);
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

  const openEditor = (index: number) => {
    const entry = getValues(`schedules.${index}`);
    setDraft({ ...entry });
    setEditingIndex(index);
  };

  const commitDraft = () => {
    if (!draft || !draft.days || draft.days === 0) return false;
    setValue(`schedules.${editingIndex}.hour`, draft.hour);
    setValue(`schedules.${editingIndex}.minute`, draft.minute);
    setValue(`schedules.${editingIndex}.days`, draft.days);
    setEditingIndex(-1);
    setDraft(null);
    return true;
  };

  const cancelDraft = () => {
    // If this was a new entry with no days, remove it
    if (editingIndex >= 0) {
      const entry = getValues(`schedules.${editingIndex}`);
      if (!entry.days || entry.days === 0) {
        remove(editingIndex);
      }
    }
    setEditingIndex(-1);
    setDraft(null);
  };

  const removeEntry = (index: number) => {
    remove(index);
  };

  const addEntry = () => {
    append({ hour: "9", minute: "00", days: 0 });
    setDraft({ hour: "9", minute: "00", days: 0 });
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
        {errors.title && (
          <Text style={styles.error}>{errors.title.message}</Text>
        )}

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
          <Text style={styles.error}>{errors.description.message}</Text>
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
                  canRemove={fields.length > 1}
                  onEdit={() => openEditor(index)}
                  onRemove={() => removeEntry(index)}
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
        <Pressable style={styles.saveButton} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>

        {onDelete && (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Habit</Text>
          </Pressable>
        )}
      </View>

      {draft && (
        <ScheduleEditorModal
          draft={draft}
          onDraftChange={setDraft}
          onCommit={commitDraft}
          onCancel={cancelDraft}
          canRemove={fields.length > 1}
          onRemove={() => {
            removeEntry(editingIndex);
            setEditingIndex(-1);
            setDraft(null);
          }}
        />
      )}
    </View>
  );
}

function ScheduleEntrySummary({
  index,
  watch,
  canRemove,
  onEdit,
  onRemove,
}: {
  index: number;
  watch: any;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const hour = watch(`schedules.${index}.hour`);
  const minute = watch(`schedules.${index}.minute`);
  const days = watch(`schedules.${index}.days`) ?? 0;

  return (
    <View style={styles.summaryRow}>
      <Pressable style={styles.summaryContent} onPress={onEdit}>
        <Text style={styles.summaryText}>
          {formatDays(days)} · {formatTime(hour, minute)}
        </Text>
      </Pressable>
      {canRemove && (
        <Pressable style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeButtonText}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

function ScheduleEditorModal({
  draft,
  onDraftChange,
  onCommit,
  onCancel,
  canRemove,
  onRemove,
}: {
  draft: ScheduleEntry;
  onDraftChange: (d: ScheduleEntry) => void;
  onCommit: () => boolean;
  onCancel: () => void;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const timeValue = useMemo(
    () => timeFromStrings(draft.hour, draft.minute),
    [draft.hour, draft.minute],
  );

  const onTimeChange = useCallback(
    (_: any, date?: Date) => {
      if (!date) return;
      onDraftChange({
        ...draft,
        hour: String(date.getHours()),
        minute: String(date.getMinutes()).padStart(2, "0"),
      });
    },
    [draft, onDraftChange],
  );

  const toggleDay = useCallback(
    (dow: number) => {
      const bit = 1 << dow;
      const newDays = (draft.days ?? 0) ^ bit;
      onDraftChange({ ...draft, days: newDays });
      setValidationError(null);
    },
    [draft, onDraftChange],
  );

  const handleDone = () => {
    if (!draft.days || draft.days === 0) {
      setValidationError("Select at least one day");
      return;
    }
    onCommit();
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Schedule</Text>

          <View style={styles.daysRow}>
            {dayLabels.map((label, dow) => {
              const bit = 1 << dow;
              const checked = (draft.days ?? 0) & bit;
              return (
                <Pressable
                  key={dow}
                  style={[
                    styles.dayTile,
                    checked ? styles.dayTileActive : null,
                  ]}
                  onPress={() => toggleDay(dow)}
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

          {validationError && (
            <Text style={styles.error}>{validationError}</Text>
          )}

          <DateTimePicker
            value={timeValue}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            style={styles.timePicker}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            {canRemove && (
              <Pressable
                style={[styles.removeButton, { marginLeft: "auto" }]}
                onPress={onRemove}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  error: {
    color: "#ff3b30",
    fontSize: 12,
    marginTop: 4,
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
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
  },
  summaryContent: {
    flex: 1,
  },
  summaryText: {
    fontSize: 15,
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  modalActions: {
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
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  removeButtonText: {
    color: "#ff3b30",
    fontSize: 14,
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
