import { Pressable, StyleSheet, Text } from "react-native";

interface SaveButtonProps {
  onPress: () => void;
}

export const SaveButton = ({ onPress }: SaveButtonProps) => {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>Save</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
