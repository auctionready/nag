import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { HabitGlyph, type HabitIconKind } from "../glyphs";

export interface ArchivedHabitItemProps {
  title: string;
  icon: string | null;
  /** Mono caption, e.g. "daily · archived 12 Apr". */
  meta: string;
  /** Hairline divider above — set for every row except the first. */
  withDivider?: boolean;
  onPress: () => void;
}

/** A single archived-habit row: glyph badge · title + meta · chevron. */
export const ArchivedHabitItem = ({
  title,
  icon,
  meta,
  withDivider,
  onPress,
}: ArchivedHabitItemProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={title}
    style={({ pressed }) => [
      styles.row,
      withDivider && styles.divider,
      pressed && styles.pressed,
    ]}
  >
    <View style={styles.badge}>
      <HabitGlyph
        kind={icon as HabitIconKind | null}
        size={18}
        color={tokens.ink}
      />
    </View>
    <View style={styles.text}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>
    </View>
    <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
      <Path
        d="M1 1l4 4.5L1 10"
        stroke={tokens.mute}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border,
  },
  pressed: {
    backgroundColor: tokens.inkTint,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.14,
  },
  meta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.4,
    marginTop: 3,
  },
});
