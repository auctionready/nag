import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";

interface SectionLabelProps {
  children: string;
  hint?: string;
}

// Mono caps label used above each form section. Optional hint sits to the
// right (e.g. "how often you'll do it" beside the cadence header).
export const SectionLabel = ({ children, hint }: SectionLabelProps) => {
  if (!hint) {
    return <Text style={styles.label}>{children}</Text>;
  }
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{children}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  hint: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.8,
  },
});
