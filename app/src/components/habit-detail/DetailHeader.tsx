import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BarChartGlyph,
  ChevronLeftGlyph,
  EditGlyph,
} from "../../components/glyphs";
import { tokens } from "../../components/theme";
import { IconButton } from "./IconButton";

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
          glyph=<ChevronLeftGlyph color={tokens.ink} />
        />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightCluster}>
          {showHistory && (
            <IconButton
              accessibilityLabel="History"
              onPress={onOpenHistory}
              glyph=<BarChartGlyph color={tokens.ink} />
            />
          )}
          {showEdit && (
            <IconButton
              accessibilityLabel="Edit"
              onPress={onEdit}
              glyph=<EditGlyph color={tokens.ink} strokeWidth={1.7} />
            />
          )}
        </View>
      </View>
    </View>
  );
};

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
