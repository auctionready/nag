import { StyleSheet, Text } from "react-native";

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  error: {
    color: "#ff3b30",
    fontSize: 12,
    marginTop: 4,
  },
});
