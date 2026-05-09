import { Pressable, StyleSheet } from "react-native";
import { tokens } from "../../components/theme";

interface IconButtonProps {
  glyph: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
}

/**
 * Circular tap target used in `DetailHeader` (and elsewhere on the
 * detail flow) — ink-tinted background, 32×32, hit-slop expanded so
 * small glyphs still feel reachable. When `onPress` is omitted the
 * button is fully transparent + non-interactive so layout stays stable.
 */
export const IconButton = ({
  glyph,
  onPress,
  accessibilityLabel,
}: IconButtonProps) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => [
      styles.iconBtn,
      pressed && styles.pressed,
      onPress ? null : styles.disabled,
    ]}
    disabled={!onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    {glyph}
  </Pressable>
);

const styles = StyleSheet.create({
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0,
  },
});
