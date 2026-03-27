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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { eq } from "drizzle-orm";
import { useEffect } from "react";
import { db } from "../../db";
import {
  habit,
  goal,
  schedule,
  regularityValues,
  type Regularity,
} from "@nag/schema";
import { processCommand } from "@nag/core";

type FormRegularity = Regularity | "none";
const formRegularityValues: FormRegularity[] = ["none", ...regularityValues];
const regularityLabels: Record<FormRegularity, string> = {
  none: "Ad-hoc",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

type GoalMode = "frequency" | "scheduled";
const goalModeValues: GoalMode[] = ["frequency", "scheduled"];
const goalModeLabels: Record<GoalMode, string> = {
  frequency: "Frequency",
  scheduled: "Scheduled",
};

const dayOfWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ScheduleEntry = {
  hour: string;
  minute: string;
  dayOfWeek?: string;
  dayOfMonth?: string;
};

type FormData = {
  title: string;
  description: string;
  regularity: FormRegularity;
  frequency: string;
  goalMode: GoalMode;
  schedules: ScheduleEntry[];
};

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const habitId = Number(id);

  const { data: habits } = useLiveQuery(
    db.select().from(habit).where(eq(habit.id, habitId)),
  );
  const habitData = habits?.[0];

  const { data: goals } = useLiveQuery(
    db.select().from(goal).where(eq(goal.habitId, habitId)),
  );
  const goalData = goals?.[0];

  const { data: scheduleData } = useLiveQuery(
    goalData
      ? db.select().from(schedule).where(eq(schedule.goalId, goalData.id))
      : db.select().from(schedule).where(eq(schedule.goalId, -1)),
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      regularity: "none",
      frequency: "1",
      goalMode: "frequency",
      schedules: [{ hour: "9", minute: "00" }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });
  const watchedRegularity = watch("regularity");
  const watchedGoalMode = watch("goalMode");

  useEffect(() => {
    if (habitData) {
      const hasSchedules = scheduleData && scheduleData.length > 0;
      reset({
        title: habitData.title,
        description: habitData.description ?? "",
        regularity: (goalData?.regularity as FormRegularity) ?? "none",
        frequency: goalData ? String(goalData.frequency) : "1",
        goalMode: hasSchedules ? "scheduled" : "frequency",
        schedules: hasSchedules
          ? scheduleData.map((s) => ({
              hour: String(s.hour),
              minute: String(s.minute).padStart(2, "0"),
              ...(s.dayOfWeek != null
                ? { dayOfWeek: String(s.dayOfWeek) }
                : {}),
              ...(s.dayOfMonth != null
                ? { dayOfMonth: String(s.dayOfMonth) }
                : {}),
            }))
          : [{ hour: "9", minute: "00" }],
      });
    }
  }, [habitData, goalData, scheduleData, reset]);

  const onSubmit = async (data: FormData) => {
    let goalPayload;
    if (data.regularity !== "none") {
      if (data.goalMode === "scheduled") {
        goalPayload = {
          regularity: data.regularity,
          schedules: data.schedules.map((s) => ({
            hour: Number(s.hour),
            minute: Number(s.minute),
            ...(data.regularity === "week"
              ? { dayOfWeek: Number(s.dayOfWeek) }
              : {}),
            ...(data.regularity === "month"
              ? { dayOfMonth: Number(s.dayOfMonth) }
              : {}),
          })),
        };
      } else {
        goalPayload = {
          regularity: data.regularity,
          frequency: Number(data.frequency),
        };
      }
    }

    await processCommand(db, {
      type: "UpdateHabit",
      habitId,
      title: data.title,
      description: data.description || null,
      goal: goalPayload ?? null,
    });

    router.back();
  };

  const onDelete = () => {
    Alert.alert(
      "Delete Habit",
      "Are you sure? This will also delete all check-ins and goals for this habit.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await processCommand(db, { type: "DeleteHabit", habitId });
            router.dismissAll();
          },
        },
      ],
    );
  };

  if (!habitData) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
      {errors.title && <Text style={styles.error}>{errors.title.message}</Text>}

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
                  onPress={() => onChange(r)}
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

        {watchedRegularity !== "none" && (
          <>
            <Controller
              control={control}
              name="goalMode"
              render={({ field: { onChange, value } }) => (
                <View style={styles.segmentedRow}>
                  {goalModeValues.map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.segmentButton,
                        value === m && styles.segmentButtonActive,
                      ]}
                      onPress={() => onChange(m)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          value === m && styles.segmentTextActive,
                        ]}
                      >
                        {goalModeLabels[m]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            />

            {watchedGoalMode === "frequency" ? (
              <View style={styles.frequencyRow}>
                  <Controller
                    control={control}
                    name="frequency"
                    rules={{
                      validate: (v) => {
                        if (watchedGoalMode !== "frequency") return true;
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
            ) : (
              <>
                <Text style={styles.label}>
                  Scheduled Times ({fields.length}x per {watchedRegularity})
                </Text>
                {fields.map((field, index) => (
                  <View key={field.id} style={styles.scheduleRow}>
                    {watchedRegularity === "week" && (
                      <Controller
                        control={control}
                        name={`schedules.${index}.dayOfWeek`}
                        rules={{
                          validate: (v) => {
                            if (watchedGoalMode !== "scheduled") return true;
                            if (watchedRegularity !== "week") return true;
                            const n = Number(v);
                            return (
                              (Number.isInteger(n) && n >= 0 && n <= 6) ||
                              "0-6"
                            );
                          },
                        }}
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.dayOfWeekRow}>
                            {dayOfWeekLabels.map((label, dow) => (
                              <Pressable
                                key={dow}
                                style={[
                                  styles.dayButton,
                                  String(dow) === value &&
                                    styles.dayButtonActive,
                                ]}
                                onPress={() => onChange(String(dow))}
                              >
                                <Text
                                  style={[
                                    styles.dayButtonText,
                                    String(dow) === value &&
                                      styles.dayButtonTextActive,
                                  ]}
                                >
                                  {label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      />
                    )}

                    {watchedRegularity === "month" && (
                      <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>Day</Text>
                        <Controller
                          control={control}
                          name={`schedules.${index}.dayOfMonth`}
                          rules={{
                            validate: (v) => {
                              if (watchedGoalMode !== "scheduled") return true;
                              if (watchedRegularity !== "month") return true;
                              const n = Number(v);
                              return (
                                (Number.isInteger(n) && n >= 1 && n <= 31) ||
                                "1-31"
                              );
                            },
                          }}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={[styles.input, styles.timeInput]}
                              onBlur={onBlur}
                              onChangeText={onChange}
                              value={value}
                              keyboardType="number-pad"
                              placeholder="1"
                            />
                          )}
                        />
                      </View>
                    )}

                    <View style={styles.timeRow}>
                      <View style={styles.timePill}>
                        <Controller
                          control={control}
                          name={`schedules.${index}.hour`}
                          rules={{
                            validate: (v) => {
                              if (watchedGoalMode !== "scheduled") return true;
                              const n = Number(v);
                              return (
                                (Number.isInteger(n) && n >= 0 && n <= 23) ||
                                "0-23"
                              );
                            },
                          }}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={styles.timePillInput}
                              onBlur={() => {
                                const n = Math.min(23, Math.max(0, parseInt(value, 10) || 0));
                                onChange(String(n));
                                onBlur();
                              }}
                              onChangeText={onChange}
                              value={value}
                              keyboardType="number-pad"
                              maxLength={2}
                              placeholder="9"
                              placeholderTextColor="#999"
                              selectTextOnFocus
                            />
                          )}
                        />
                        <Text style={styles.timePillSeparator}>:</Text>
                        <Controller
                          control={control}
                          name={`schedules.${index}.minute`}
                          rules={{
                            validate: (v) => {
                              if (watchedGoalMode !== "scheduled") return true;
                              const n = Number(v);
                              return (
                                (Number.isInteger(n) && n >= 0 && n <= 59) ||
                                "0-59"
                              );
                            },
                          }}
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={styles.timePillInput}
                              onBlur={() => {
                                const n = Math.min(59, Math.max(0, parseInt(value, 10) || 0));
                                onChange(String(n).padStart(2, "0"));
                                onBlur();
                              }}
                              onChangeText={onChange}
                              value={value}
                              keyboardType="number-pad"
                              maxLength={2}
                              placeholder="00"
                              placeholderTextColor="#999"
                              selectTextOnFocus
                            />
                          )}
                        />
                      </View>
                      {fields.length > 1 && (
                        <Pressable
                          style={styles.removeButton}
                          onPress={() => remove(index)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
                <Pressable
                  style={styles.addTimeButton}
                  onPress={() =>
                    append({
                      hour: "9",
                      minute: "00",
                      ...(watchedRegularity === "week"
                        ? { dayOfWeek: "1" }
                        : {}),
                      ...(watchedRegularity === "month"
                        ? { dayOfMonth: "1" }
                        : {}),
                    })
                  }
                >
                  <Text style={styles.addTimeButtonText}>+ Add Time</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>

      <Pressable style={styles.saveButton} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete Habit</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
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
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
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
  scheduleRow: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    gap: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: "#666",
    width: 36,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f7",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  timePillInput: {
    fontSize: 20,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    color: "#007AFF",
    textAlign: "center",
    width: 40,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  timePillSeparator: {
    fontSize: 20,
    fontWeight: "500",
    color: "#007AFF",
  },
  removeButton: {
    marginLeft: "auto",
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
  dayOfWeekRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  dayButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  dayButtonTextActive: {
    color: "#fff",
  },
});
