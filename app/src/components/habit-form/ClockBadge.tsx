import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "../theme";

// Small orange-tinted clock badge that prefixes a schedule entry row.
export const ClockBadge = () => (
  <View style={styles.badge}>
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.2} stroke={tokens.orange} strokeWidth={1.7} />
      <Path
        d="M7 4v3l2 1.5"
        stroke={tokens.orange}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,90,54,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
