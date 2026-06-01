import type { ReactNode } from "react";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "../theme";
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
  /** Draw a hairline divider above this item. */
  divider?: boolean;
}

export interface HabitActionsMenuProps {
  items: HabitActionItem[];
}

/**
 * Dumb hamburger menu: a header button that opens a dropdown of the given
 * `items` inside a transparent Modal. It owns only presentation — open /
 * close, the active-button treatment, and dismiss-on-tap. The caller (a
 * smart component) decides which items exist, their copy/icons, and what
 * each does; selecting an enabled item closes the menu and runs it.
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
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => select(item)}
                disabled={item.disabled}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: !!item.disabled }}
                style={({ pressed }) => [
                  styles.item,
                  item.divider && styles.divider,
                  item.disabled && styles.itemDisabled,
                  pressed && !item.disabled && styles.itemPressed,
                ]}
              >
                {item.icon != null && (
                  <View
                    style={[styles.badge, item.danger && styles.badgeDanger]}
                  >
                    {item.icon}
                  </View>
                )}
                <View style={styles.itemText}>
                  <Text
                    style={[styles.label, item.danger && styles.labelDanger]}
                  >
                    {item.label}
                  </Text>
                  {item.sub != null && (
                    <Text style={styles.sub}>{item.sub}</Text>
                  )}
                </View>
              </Pressable>
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border,
  },
  itemDisabled: {
    opacity: 0.4,
  },
  itemPressed: {
    backgroundColor: tokens.inkTint,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDanger: {
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.14,
  },
  labelDanger: {
    color: tokens.orange,
  },
  sub: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
    marginTop: 1,
  },
});
