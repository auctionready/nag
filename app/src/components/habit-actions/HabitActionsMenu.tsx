import type { ReactNode } from "react";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../theme";
import { ActionsMenuItem } from "./ActionsMenuItem";
import { MenuGlyph } from "./glyphs";

export interface HabitActionItem {
  key: string;
  label: string;
  /** Small mono caption under the label. */
  sub?: string;
  /** Icon rendered in the 30×30 badge (colour baked in by the caller). */
  icon?: ReactNode;
  onPress?: () => void;
  /** Render label/icon in the destructive (orange) treatment. */
  danger?: boolean;
  /** Greyed-out and non-interactive. */
  disabled?: boolean;
}

export interface HabitActionsMenuProps {
  items: HabitActionItem[];
}

/**
 * Dumb overflow menu: an ellipsis header button that opens a dropdown of
 * the given `items` inside a transparent Modal. It owns only presentation
 * — open / close, the active-button treatment, dividers, and
 * dismiss-on-tap. The caller (a smart component) decides which items
 * exist, their copy/icons, and what each does; selecting an enabled item
 * closes the menu and runs it.
 */
export const HabitActionsMenu = ({ items }: HabitActionsMenuProps) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const select = (item: HabitActionItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onPress?.();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[styles.trigger, open && styles.triggerActive]}
        accessibilityRole="button"
        accessibilityLabel="Habit actions"
      >
        <MenuGlyph color={open ? tokens.cream : tokens.ink} />
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
              <ActionsMenuItem
                key={item.key}
                label={item.label}
                sub={item.sub}
                icon={item.icon}
                danger={item.danger}
                disabled={item.disabled}
                withDivider={i > 0}
                onPress={() => select(item)}
              />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerActive: {
    backgroundColor: tokens.ink,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    right: 16,
    width: 244,
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: "hidden",
    shadowColor: tokens.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 34,
    elevation: 12,
  },
});
