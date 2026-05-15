import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { Group } from "./AccountUI";
import { confirmAndDeleteAccount } from "./deleteAccountAction";

export const DeleteAccountSection = () => (
  <Group title="Account">
    <Pressable
      onPress={confirmAndDeleteAccount}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 14 14"
          fill="none"
          stroke={tokens.orange}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M2.5 4h9" />
          <Path d="M5.5 4V2.5h3V4" />
          <Path d="M3.5 4l.5 8h6l.5-8" />
          <Path d="M5.5 6.5v3.5M8.5 6.5v3.5" />
        </Svg>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Delete account</Text>
        <Text style={styles.subtitle}>permanent · cannot be undone</Text>
      </View>
      <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
        <Path
          d="M1 1l4 4.5L1 10"
          stroke={tokens.orange}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  </Group>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,90,54,0.06)",
  },
  pressed: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,90,54,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "SpaceGrotesk-Bold",
    fontSize: 14,
    fontWeight: "700",
    color: tokens.orange,
    letterSpacing: -0.07,
  },
  subtitle: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.orange,
    opacity: 0.7,
    letterSpacing: 0.4,
  },
});
