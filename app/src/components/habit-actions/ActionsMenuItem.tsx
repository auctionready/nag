import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";

export interface ActionsMenuItemProps {
  label: string;
  /** Small mono caption under the label. */
  sub?: string;
  /** Icon rendered in the 30×30 badge (colour baked in by the caller). */
  icon?: ReactNode;
  /** Destructive (orange) treatment. */
  danger?: boolean;
  disabled?: boolean;
  /** Hairline divider above — set for every item except the first. */
  withDivider?: boolean;
  onPress?: () => void;
}

/** A single row in the {@link HabitActionsMenu} dropdown. */
export const ActionsMenuItem = ({
  label,
  sub,
  icon,
  danger,
  disabled,
  withDivider,
  onPress,
}: ActionsMenuItemProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    style={({ pressed }) => [
      styles.item,
      withDivider && styles.divider,
      disabled && styles.itemDisabled,
      pressed && !disabled && styles.itemPressed,
    ]}
  >
    {icon != null && (
      <View style={[styles.badge, danger && styles.badgeDanger]}>{icon}</View>
    )}
    <View style={styles.text}>
      <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      {sub != null && <Text style={styles.sub}>{sub}</Text>}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
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
  text: {
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
