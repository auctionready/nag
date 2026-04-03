import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useCallback, useMemo, useState } from "react";
import { dayEntries, timeFromStrings, type ScheduleEntry } from "./shared";
import { NoDays } from "./days";
import { ErrorText } from "./ErrorText";
import { RemoveButton } from "./RemoveButton";

export function ScheduleEditorModal({
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
    (_: DateTimePickerEvent, date?: Date) => {
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
    (day: number) => {
      const newDays = (draft.days ?? NoDays) ^ day;
      onDraftChange({ ...draft, days: newDays });
      setValidationError(null);
    },
    [draft, onDraftChange],
  );

  const handleDone = () => {
    if (!draft.days || draft.days === NoDays) {
      setValidationError("Select at least one day");
      return;
    }
    onCommit();
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Edit Schedule</Text>

          <View style={styles.daysRow}>
            {dayEntries.map(({ day, label }) => {
              const checked = (draft.days ?? NoDays) & day;
              return (
                <Pressable
                  key={day}
                  style={[
                    styles.dayTile,
                    checked ? styles.dayTileActive : null,
                  ]}
                  onPress={() => toggleDay(day)}
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

          {validationError && <ErrorText>{validationError}</ErrorText>}

          <View style={styles.reminderRow}>
            <Text style={styles.reminderLabel}>Reminder</Text>
            <Switch
              value={draft.reminder !== false}
              onValueChange={(v) => onDraftChange({ ...draft, reminder: v })}
            />
          </View>

          <DateTimePicker
            value={timeValue}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
            style={styles.timePicker}
          />

          <View style={styles.actions}>
            <Pressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            {canRemove && (
              <View style={{ marginLeft: "auto" }}>
                <RemoveButton onPress={onRemove} />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    gap: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
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
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderLabel: {
    fontSize: 15,
    color: "#333",
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
