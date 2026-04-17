import { useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

interface CheckInDatePickerModalProps {
  visible: boolean;
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

export const CheckInDatePickerModal = ({
  visible,
  initialDate,
  mode,
  minimumDate,
  maximumDate,
  showSkipToggle,
  initialSkipped = false,
  onConfirm,
  onCancel,
}: CheckInDatePickerModalProps) => {
  const [localDate, setLocalDate] = useState(initialDate);
  const [localSkipped, setLocalSkipped] = useState(initialSkipped);

  const onChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setLocalDate(date);
  };

  const handleConfirm = () => {
    onConfirm(localDate, showSkipToggle ? localSkipped : undefined);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>
              {mode === "time" ? "Choose Time" : "Choose Date & Time"}
            </Text>
            <Pressable onPress={handleConfirm} hitSlop={8}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <DateTimePicker
            value={localDate}
            mode={mode}
            display="spinner"
            onChange={onChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={styles.picker}
          />

          {showSkipToggle && (
            <View style={styles.skipRow}>
              <Text style={styles.skipLabel}>Skipped</Text>
              <Switch value={localSkipped} onValueChange={setLocalSkipped} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
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
