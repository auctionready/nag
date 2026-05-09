import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";

export interface HeaderProps {
  percent: number;
  line: string;
  suffix: string;
}

export const Header = ({ percent, line, suffix }: HeaderProps) => (
  <View style={styles.header}>
    <View style={styles.headerRow}>
      <Text style={styles.percent}>{percent}</Text>
      <Text style={styles.percentSuffix}>% {suffix}</Text>
    </View>
    <Text style={styles.headerLine}>{line}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  percent: {
    fontSize: 40,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -1.6,
    lineHeight: 40,
  },
  percentSuffix: {
    fontSize: 22,
    fontWeight: "500",
    color: tokens.mute,
    marginLeft: 4,
    letterSpacing: -0.5,
  },
  headerLine: {
    fontFamily: "JetBrainsMono",
    fontSize: 11.5,
    color: tokens.mute,
    letterSpacing: 0.3,
    marginTop: 4,
  },
});
