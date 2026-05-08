import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import {
  formRegularityValues,
  regularityLabels,
  type FormRegularity,
} from "./shared";

interface CadencePillsProps {
  value: FormRegularity;
  onChange: (next: FormRegularity) => void;
}

// Pill row of cadence options. Active pill is ink-filled; the rest are
// white with a hairline border. Brand orange is reserved for state and
// not used here.
export const CadencePills = ({ value, onChange }: CadencePillsProps) => (
  <View style={styles.row}>
    {formRegularityValues.map((r) => {
      const on = value === r;
      return (
        <Pressable
          key={r}
          style={[styles.pill, on && styles.pillActive]}
          onPress={() => onChange(r)}
        >
          <Text style={[styles.pillText, on && styles.pillTextActive]}>
            {regularityLabels[r]}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  pillActive: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.2,
  },
  pillTextActive: {
    color: tokens.cream,
  },
});
