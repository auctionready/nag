import { StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { tokens } from "../theme";
import {
  frequencySuffix,
  type HabitFormData,
  type FormRegularity,
} from "./shared";

interface FrequencyCardProps {
  control: Control<HabitFormData>;
  errors: FieldErrors<HabitFormData>;
  regularity: Extract<FormRegularity, "day" | "week" | "month">;
}

// Sub-control for daily/weekly/monthly cadences: a label + 1-digit input
// where the user picks how many times per period they're aiming for.
export const FrequencyCard = ({
  control,
  errors,
  regularity,
}: FrequencyCardProps) => (
  <View style={styles.card}>
    <View style={styles.text}>
      <Text style={styles.label}>{frequencySuffix[regularity]}</Text>
      <Text style={styles.hint}>how often are you aiming for</Text>
    </View>
    <Controller
      control={control}
      name="frequency"
      rules={{
        validate: (v) => {
          const n = Number(v);
          return (Number.isInteger(n) && n >= 1) || "Must be at least 1";
        },
      }}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          style={[styles.input, errors.frequency && styles.inputError]}
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
);

const styles = StyleSheet.create({
  card: {
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
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
  },
  hint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
  input: {
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
});
