import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { HabitGlyph, type HabitIconKind } from "../HabitGlyph";

interface IconSwatchProps {
  icon: HabitIconKind | null;
  open: boolean;
  onPress: () => void;
}

// Tap target on the identity card. Shows the chosen glyph (or a placeholder
// check) on an ink fill, with a small chevron in the corner that tints
// orange while the picker is open.
export const IconSwatch = ({ icon, open, onPress }: IconSwatchProps) => (
  <Pressable
    onPress={onPress}
    style={styles.swatch}
    accessibilityRole="button"
    accessibilityLabel="Choose icon"
  >
    <HabitGlyph kind={icon ?? "check"} size={22} color={tokens.cream} />
    <View style={[styles.chevron, open && styles.chevronOpen]}>
      <Text style={styles.chevronGlyph}>v</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tokens.cream,
  },
  chevronOpen: {
    backgroundColor: tokens.orange,
  },
  chevronGlyph: {
    color: tokens.cream,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 10,
  },
});
