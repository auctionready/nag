import { Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../theme";

interface CancelButtonProps {
  onPress: () => void;
  label?: string;
}

export const CancelButton = ({
  onPress,
  label = "cancel",
}: CancelButtonProps) => {
  return (
    <Pressable
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: tokens.ink,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
