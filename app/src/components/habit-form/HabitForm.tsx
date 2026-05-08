import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useEffect, useState } from "react";
import { tokens } from "../theme";
import {
  defaultValues,
  type FormRegularity,
  type HabitFormData,
  type HabitFormProps,
  type ScheduleEntry,
} from "./shared";
import { AllDays } from "@nag/core";
import { AdHocCard } from "./AdHocCard";
import { CadencePills } from "./CadencePills";
import { DangerZoneCard } from "./DangerZoneCard";
import { ErrorText } from "./ErrorText";
import { FrequencyCard } from "./FrequencyCard";
import { IdentityCard } from "./IdentityCard";
import { SaveButton } from "./SaveButton";
import { ScheduledList } from "./ScheduledList";
import { ScheduleEditorModal } from "./ScheduleEditorModal";
import { SectionLabel } from "./SectionLabel";

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

  const isFrequency =
    watchedRegularity === "day" ||
    watchedRegularity === "week" ||
    watchedRegularity === "month";
  const saveLabel = mode === "edit" ? "save changes" : "start nagging me";

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <IdentityCard control={control} titleError={errors.title?.message} />

        <View style={styles.section}>
          <SectionLabel hint="how often you'll do it">cadence</SectionLabel>
          <Controller
            control={control}
            name="regularity"
            render={({ field: { onChange, value } }) => (
              <CadencePills
                value={value}
                onChange={(next) => changeRegularity(next, onChange)}
              />
            )}
          />

          {watchedRegularity === "none" && <AdHocCard />}

          {isFrequency && (
            <FrequencyCard
              control={control}
              errors={errors}
              regularity={watchedRegularity}
            />
          )}
          {errors.frequency && (
            <ErrorText>{errors.frequency.message}</ErrorText>
          )}

          {watchedRegularity === "scheduled" && (
            <ScheduledList
              fields={fields}
              schedules={watchedSchedules}
              watch={watch}
              onEdit={openEditor}
              onAdd={addEntry}
            />
          )}
        </View>

        {onDelete && <DangerZoneCard onDelete={onDelete} />}
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
