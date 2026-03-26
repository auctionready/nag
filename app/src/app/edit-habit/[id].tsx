import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { eq } from "drizzle-orm";
import { useEffect } from "react";
import { db } from "../../db";
import { habit, goal, regularityValues, type Regularity } from "@nag/schema";

const regularityLabels: Record<Regularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

type FormData = {
  title: string;
  description: string;
  regularity: Regularity;
  frequency: string;
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

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      regularity: "day",
      frequency: "1",
    },
  });

  useEffect(() => {
    if (habitData) {
      reset({
        title: habitData.title,
        description: habitData.description ?? "",
        regularity: (goalData?.regularity as Regularity) ?? "day",
        frequency: goalData ? String(goalData.frequency) : "1",
      });
    }
  }, [habitData, goalData, reset]);

  const onSubmit = async (data: FormData) => {
    await db
      .update(habit)
      .set({
        title: data.title,
        description: data.description || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(habit.id, habitId));

    await db.delete(goal).where(eq(goal.habitId, habitId));
    await db.insert(goal).values({
      habitId,
      regularity: data.regularity,
      frequency: Number(data.frequency),
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
            await db.delete(habit).where(eq(habit.id, habitId));
            router.back();
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
    <View style={styles.container}>
      <Text style={styles.label}>Title</Text>
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

      <Text style={styles.label}>Description</Text>
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
        <Text style={styles.sectionTitle}>Goal</Text>

        <Text style={styles.label}>Regularity</Text>
        <Controller
          control={control}
          name="regularity"
          render={({ field: { onChange, value } }) => (
            <View style={styles.segmentedRow}>
              {regularityValues.map((r) => (
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

        <Text style={styles.label}>Frequency</Text>
        <Controller
          control={control}
          name="frequency"
          rules={{
            required: "Frequency is required",
            validate: (v) => {
              const n = Number(v);
              return (Number.isInteger(n) && n >= 1) || "Must be at least 1";
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
        {errors.frequency && (
          <Text style={styles.error}>{errors.frequency.message}</Text>
        )}
      </View>

      <Pressable style={styles.saveButton} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete Habit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
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
  frequencyInput: {
    width: 80,
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
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
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
    marginTop: 24,
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
    marginTop: 16,
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
});
