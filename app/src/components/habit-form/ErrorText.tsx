import { StyleSheet, Text } from "react-native";
import { tokens } from "../theme";

interface ErrorTextProps {
  children: React.ReactNode;
}

export const ErrorText = ({ children }: ErrorTextProps) => {
  return <Text style={styles.error}>{children}</Text>;
};

const styles = StyleSheet.create({
  error: {
    color: tokens.orange,
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
