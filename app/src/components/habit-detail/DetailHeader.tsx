import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { tokens } from "../../components/theme";

interface DetailHeaderProps {
  /** Eyebrow label centred in the header — defaults to "habit". */
  title?: string;
  onBack: () => void;
  /** Hidden when on a sub-screen that already lives under "history". */
  showHistory?: boolean;
  /** Hidden when the user can't edit (e.g. on the history screen). */
  showEdit?: boolean;
  onOpenHistory?: () => void;
  onEdit?: () => void;
}

/**
 * Custom in-screen header for the habit detail / history pages: back
 * chevron on the left, monospace eyebrow centred, and circular icon
 * buttons on the right (history graph + pencil). Replaces the default
 * stack header for these routes — see `_layout.tsx` where `headerShown`
 * is disabled for `habit/[id]`.
 */
export const DetailHeader = ({
  title = "habit",
  onBack,
  showHistory = true,
  showEdit = true,
  onOpenHistory,
  onEdit,
}: DetailHeaderProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <IconButton
          accessibilityLabel="Back"
          onPress={onBack}
          glyph={
            <Svg
              width={12}
              height={12}
              viewBox="0 0 11 11"
              fill="none"
              stroke={tokens.ink}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M7 1L2.5 5.5 7 10" />
            </Svg>
          }
        />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightCluster}>
          {showHistory && (
            <IconButton
              accessibilityLabel="History"
              onPress={onOpenHistory}
              glyph={
                <Svg
                  width={14}
                  height={14}
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke={tokens.ink}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M2 12h10" />
                  <Rect x={3} y={7.5} width={2} height={3.5} rx={0.4} />
                  <Rect x={6} y={5} width={2} height={6} rx={0.4} />
                  <Rect x={9} y={2.5} width={2} height={8.5} rx={0.4} />
                </Svg>
              }
            />
          )}
          {showEdit && (
            <IconButton
              accessibilityLabel="Edit"
              onPress={onEdit}
              glyph={
                <Svg
                  width={14}
                  height={14}
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke={tokens.ink}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M9 2.5l2.5 2.5L4.5 12 2 12.5l.5-2.5L9 2.5z" />
                </Svg>
              }
            />
          )}
        </View>
      </View>
    </View>
  );
};

const IconButton = ({
  glyph,
  onPress,
  accessibilityLabel,
}: {
  glyph: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
}) => (
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
  wrap: {
    backgroundColor: tokens.cream,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  eyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
