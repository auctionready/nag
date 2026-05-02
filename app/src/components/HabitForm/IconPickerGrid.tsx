import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { HabitGlyph, type HabitIconKind } from "../HabitGlyph";
import { HABIT_ICON_KINDS } from "./shared";

interface IconPickerGridProps {
  selected: HabitIconKind | null;
  onSelect: (icon: HabitIconKind | null) => void;
}

interface IconCellProps {
  kind: HabitIconKind;
  selected: boolean;
  onPress: () => void;
}

const IconCell = ({ kind, selected, onPress }: IconCellProps) => (
  <Pressable
    onPress={onPress}
    style={[styles.cell, selected && styles.cellActive]}
    accessibilityRole="button"
    accessibilityLabel={`Icon ${kind}`}
  >
    <HabitGlyph
      kind={kind}
      size={20}
      color={selected ? tokens.cream : tokens.ink}
    />
  </Pressable>
);

// 6-column grid of the 24 habit glyphs. Tapping the active glyph clears it.
export const IconPickerGrid = ({ selected, onSelect }: IconPickerGridProps) => (
  <View style={styles.wrapper}>
    <Text style={styles.label}>pick icon</Text>
    <View style={styles.grid}>
      {HABIT_ICON_KINDS.map((kind) => {
        const on = kind === selected;
        return (
          <IconCell
            key={kind}
            kind={kind}
            selected={on}
            onPress={() => onSelect(on ? null : kind)}
          />
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: "100%",
    gap: 8,
    paddingTop: 4,
  },
  label: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cell: {
    width: "15.4%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: {
    backgroundColor: tokens.ink,
    borderWidth: 2,
    borderColor: tokens.orange,
  },
});
