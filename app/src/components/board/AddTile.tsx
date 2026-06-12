import { Pressable, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../../components/theme";

export interface AddTileProps {
  onPress: () => void;
}

export const AddTile = ({ onPress }: AddTileProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
  >
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 2v10M2 7h10"
        stroke={tokens.mute}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
    <Text style={styles.addTileText}>add habit</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  addTile: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: tokens.faint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  addTileText: {
    color: tokens.mute,
    fontSize: 14,
    fontWeight: "500",
  },
});
