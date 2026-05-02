import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useEffect, useState } from "react";
import { tokens } from "../theme";
import {
  defaultValues,
  formRegularityValues,
  frequencySuffix,
  regularityLabels,
  type FormRegularity,
  type HabitFormData,
  type HabitFormProps,
  type ScheduleEntry,
} from "./shared";
import { AllDays } from "@nag/core";
import { IdentityCard } from "./IdentityCard";
import { ScheduleEntrySummary } from "./ScheduleEntrySummary";
import { ScheduleEditorModal } from "./ScheduleEditorModal";
import { ErrorText } from "./ErrorText";
import { SaveButton } from "./SaveButton";

export const HabitForm = ({
  initialValues,
  onSubmit,
  onDelete,
  mode = "create",
}: HabitFormProps) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid, isSubmitting },
  } = useForm<HabitFormData>({
    defaultValues: { ...defaultValues, ...initialValues },
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });
  const watchedRegularity = watch("regularity");
  const watchedSchedules = watch("schedules");
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
  const saveLabel = mode === "edit" ? "save changes" : "start nagging me";

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <IdentityCard control={control} titleError={errors.title?.message} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>cadence</Text>
            <Text style={styles.sectionHint}>how often you&apos;ll do it</Text>
          </View>
          <Controller
            control={control}
            name="regularity"
            render={({ field: { onChange, value } }) => (
              <View style={styles.cadenceRow}>
                {formRegularityValues.map((r) => {
                  const on = value === r;
                  return (
                    <Pressable
                      key={r}
                      style={[
                        styles.cadencePill,
                        on && styles.cadencePillActive,
                      ]}
                      onPress={() => changeRegularity(r, onChange)}
                    >
                      <Text
                        style={[
                          styles.cadencePillText,
                          on && styles.cadencePillTextActive,
                        ]}
                      >
                        {regularityLabels[r]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />

          {watchedRegularity === "none" && (
            <View style={styles.adHocCard}>
              <Text style={styles.adHocText}>
                log it whenever — no schedule, no nags. just a streak counter.
              </Text>
            </View>
          )}

          {isFrequency && (
            <View style={styles.frequencyCard}>
              <View style={styles.frequencyText}>
                <Text style={styles.frequencyLabel}>
                  {
                    frequencySuffix[
                      watchedRegularity as "day" | "week" | "month"
                    ]
                  }
                </Text>
                <Text style={styles.frequencyHint}>
                  how often are you aiming for
                </Text>
              </View>
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
                      styles.frequencyInput,
                      errors.frequency && styles.inputError,
                    ]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={tokens.faint}
                  />
                )}
              />
            </View>
          )}
          {errors.frequency && (
            <ErrorText>{errors.frequency.message}</ErrorText>
          )}

          {watchedRegularity === "scheduled" && (
            <View style={styles.scheduledList}>
              {fields
                .map((field, index) => ({ field, index }))
                .sort((a, b) => {
                  const as = watchedSchedules?.[a.index];
                  const bs = watchedSchedules?.[b.index];
                  const aMins =
                    (Number(as?.hour) || 0) * 60 + (Number(as?.minute) || 0);
                  const bMins =
                    (Number(bs?.hour) || 0) * 60 + (Number(bs?.minute) || 0);
                  return aMins - bMins;
                })
                .map(({ field, index }) => (
                  <ScheduleEntrySummary
                    key={field.id}
                    index={index}
                    watch={watch}
                    onEdit={() => openEditor(index)}
                  />
                ))}
              <Pressable style={styles.addTimeButton} onPress={addEntry}>
                <Text style={styles.addTimePlus}>+</Text>
                <Text style={styles.addTimeText}>add time</Text>
              </Pressable>
            </View>
          )}
        </View>

        {onDelete && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>danger zone</Text>
            <Pressable
              style={styles.dangerCard}
              onPress={() => {
                Alert.alert(
                  "Delete Habit",
                  "Are you sure? This will also delete all check-ins and goals for this habit.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: onDelete },
                  ],
                );
              }}
            >
              <View style={styles.dangerIcon}>
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                  <Path
                    d="M2.5 3.5h9M5 3.5V2.5h4v1M3.5 3.5L4 12h6l.5-8.5M5.5 6v4M8.5 6v4"
                    stroke={tokens.orange}
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.dangerText}>
                <Text style={styles.dangerTitle}>delete habit</Text>
                <Text style={styles.dangerSub}>
                  history is kept for 30 days
                </Text>
              </View>
              <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
                <Path
                  d="M1 1l4 4.5L1 10"
                  stroke={tokens.orange}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <SaveButton
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || isSubmitting}
          label={saveLabel}
        />
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
    backgroundColor: tokens.cream,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 22,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  sectionHint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.8,
  },
  cadenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cadencePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  cadencePillActive: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  cadencePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.2,
  },
  cadencePillTextActive: {
    color: tokens.cream,
  },
  adHocCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  adHocText: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.mute,
  },
  frequencyCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  frequencyText: {
    flex: 1,
    gap: 2,
  },
  frequencyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
  },
  frequencyHint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
  frequencyInput: {
    width: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    fontSize: 15,
    fontWeight: "700",
    color: tokens.ink,
    textAlign: "center",
    backgroundColor: tokens.cream,
  },
  inputError: {
    borderColor: tokens.orange,
  },
  scheduledList: {
    gap: 10,
  },
  addTimeButton: {
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
  addTimePlus: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.ink,
    lineHeight: 18,
  },
  addTimeText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.1,
  },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dangerIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,90,54,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    flex: 1,
    gap: 2,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.orange,
  },
  dangerSub: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: tokens.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border,
    flexDirection: "row",
    gap: 10,
  },
});
