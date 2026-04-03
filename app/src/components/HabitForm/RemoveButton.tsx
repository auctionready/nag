import { Pressable, StyleSheet, Text } from "react-native";

interface RemoveButtonProps {
  onPress: () => void;
}

export const RemoveButton = ({ onPress }: RemoveButtonProps) => {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>Remove</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: "#ff3b30",
    fontSize: 14,
    fontWeight: "600",
  },
});
