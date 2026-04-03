import { Modal, StyleSheet, Text, View } from "react-native";
import { type ScheduleEntry } from "./shared";
import { ScheduleEntryForm } from "./ScheduleEntryForm";

export function ScheduleEditorModal({
  initialValues,
  isNew,
  onCommit,
  onCancel,
  canRemove,
  onRemove,
}: {
  initialValues: ScheduleEntry;
  isNew: boolean;
  onCommit: (data: ScheduleEntry) => void;
  onCancel: () => void;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Edit Schedule</Text>
          <ScheduleEntryForm
            initialValues={initialValues}
            isNew={isNew}
            onSubmit={onCommit}
            onCancel={onCancel}
            canRemove={canRemove}
            onRemove={onRemove}
          />
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
});
