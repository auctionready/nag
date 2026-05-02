import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

interface SaveButtonProps {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}

export const SaveButton = ({
  onPress,
  disabled,
  label = "save",
}: SaveButtonProps) => {
  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{label}</Text>
      <View style={styles.arrow}>
        <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
          <Path
            d="M3 6.5h7M7 3l3.5 3.5L7 10"
            stroke={tokens.cream}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.ink,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  text: {
    color: tokens.cream,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  arrow: {
    marginTop: 1,
  },
});
