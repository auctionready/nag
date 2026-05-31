import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

export interface HabitActionItem {
  key: string;
  label: string;
  onPress: () => void;
  /** Render the label in the destructive (orange) colour. */
  danger?: boolean;
}

export interface HabitActionsMenuProps {
  items: HabitActionItem[];
}

/**
 * Dumb hamburger menu: renders a header button that opens a dropdown of
 * the given `items` inside a transparent Modal. It owns only presentation
 * — opening/closing and dismiss-on-tap. The caller (a smart component)
 * decides which items exist and what they do; selecting one closes the
 * menu and invokes its `onPress`.
 */
export const HabitActionsMenu = ({ items }: HabitActionsMenuProps) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const select = (item: HabitActionItem) => {
    setOpen(false);
    item.onPress();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Habit actions"
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          {[6, 12, 18].map((y) => (
            <Path
              key={y}
              d={`M4 ${y}h16`}
              stroke={tokens.ink}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          ))}
        </Svg>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 52 }]}>
            {items.map((item, i) => (
              <Pressable
                key={item.key}
                onPress={() => select(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && styles.itemBorder,
                  pressed && styles.itemPressed,
                ]}
              >
                <Text style={[styles.itemLabel, item.danger && styles.danger]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

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
  backdrop: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    right: 12,
    minWidth: 168,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: tokens.veryFaint,
  },
  itemPressed: {
    backgroundColor: tokens.inkTint,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.2,
  },
  danger: {
    color: tokens.orange,
  },
});
