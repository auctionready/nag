import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useForm, Controller } from "react-hook-form";

interface CheckInFormValues {
  timestamp: Date;
  skipped: boolean;
}

interface CheckInFormProps {
  initialDate: Date;
  /** "time" = time-only picker; "datetime" = date + time picker. */
  mode: "time" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
  /** Show a "Skipped" toggle — only relevant when editing an existing check-in. */
  showSkipToggle?: boolean;
  initialSkipped?: boolean;
  onConfirm: (date: Date, skipped?: boolean) => void;
  onCancel: () => void;
}

export const CheckInForm = ({
  initialDate,
  mode,
  minimumDate,
  maximumDate,
  showSkipToggle,
  initialSkipped = false,
  onConfirm,
  onCancel,
}: CheckInFormProps) => {
  const { control, handleSubmit } = useForm<CheckInFormValues>({
    defaultValues: { timestamp: initialDate, skipped: initialSkipped },
  });

  const onSubmit = ({ timestamp, skipped }: CheckInFormValues) => {
    onConfirm(timestamp, showSkipToggle ? skipped : undefined);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>
          {mode === "time" ? "Choose Time" : "Choose Date & Time"}
        </Text>
        <Pressable onPress={handleSubmit(onSubmit)} hitSlop={8}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      <Controller
        control={control}
        name="timestamp"
        render={({ field: { value, onChange } }) => (
          <DateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            onValueChange={(_, date) => onChange(date)}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={styles.picker}
          />
        )}
      />

      {showSkipToggle && (
        <Controller
          control={control}
          name="skipped"
          render={({ field: { value, onChange } }) => (
            <View style={styles.skipRow}>
              <Text style={styles.skipLabel}>Skipped</Text>
              <Switch value={value} onValueChange={onChange} />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  doneText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  picker: {
    height: 150,
  },
  skipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  skipLabel: {
    fontSize: 15,
    color: "#333",
  },
});
