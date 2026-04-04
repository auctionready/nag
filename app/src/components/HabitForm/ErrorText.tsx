import { StyleSheet, Text } from "react-native";

interface ErrorTextProps {
  children: React.ReactNode;
}

export const ErrorText = ({ children }: ErrorTextProps) => {
  return <Text style={styles.error}>{children}</Text>;
};

const styles = StyleSheet.create({
  error: {
    color: "#ff3b30",
    fontSize: 12,
    marginTop: 4,
  },
});
