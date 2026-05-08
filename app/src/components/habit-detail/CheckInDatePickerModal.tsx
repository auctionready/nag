import { Modal, StyleSheet, View } from "react-native";
import { CheckInForm } from "./CheckInForm";

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
  ...formProps
}: CheckInDatePickerModalProps) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.overlay}>
      <View style={styles.content}>
        <CheckInForm {...formProps} />
      </View>
    </View>
  </Modal>
);

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
  },
});
