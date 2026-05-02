import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { SectionLabel } from "./SectionLabel";

interface DangerZoneCardProps {
  onDelete: () => void;
}

const TrashIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <Path
      d="M2.5 3.5h9M5 3.5V2.5h4v1M3.5 3.5L4 12h6l.5-8.5M5.5 6v4M8.5 6v4"
      stroke={tokens.orange}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ChevronRight = () => (
  <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
    <Path
      d="M1 1l4 4.5L1 10"
      stroke={tokens.orange}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Edit-mode delete affordance — confirms via Alert before invoking
// onDelete so a stray tap can't nuke a habit.
export const DangerZoneCard = ({ onDelete }: DangerZoneCardProps) => {
  const confirm = () => {
    Alert.alert(
      "Delete Habit",
      "Are you sure? This will also delete all check-ins and goals for this habit.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <SectionLabel>danger zone</SectionLabel>
      <Pressable style={styles.card} onPress={confirm}>
        <View style={styles.iconBadge}>
          <TrashIcon />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>delete habit</Text>
          <Text style={styles.sub}>deletion is permanent</Text>
        </View>
        <ChevronRight />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,90,54,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.orange,
  },
  sub: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 11,
    color: tokens.mute,
  },
});
