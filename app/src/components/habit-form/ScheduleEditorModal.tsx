import { Modal, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { type ScheduleEntry } from "./shared";
import { ScheduleEntryForm } from "./ScheduleEntryForm";

interface ScheduleEditorModalProps {
  initialValues: ScheduleEntry;
  isNew: boolean;
  onCommit: (data: ScheduleEntry) => void;
  onCancel: () => void;
  canRemove: boolean;
  onRemove: () => void;
}

export const ScheduleEditorModal = ({
  initialValues,
  isNew,
  onCommit,
  onCancel,
  canRemove,
  onRemove,
}: ScheduleEditorModalProps) => {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>edit time-timeSlot</Text>
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
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(26,20,16,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: tokens.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.faint,
  },
  title: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
