import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";
import { SyncDot } from "../sync";

export interface HeaderProps {
  percent: number;
  line: string;
  suffix: string;
  /** Eyebrow date, e.g. "sat · 2 may". Omitted → no eyebrow row. */
  dateLabel?: string;
}

export const Header = ({ percent, line, suffix, dateLabel }: HeaderProps) => (
  <View style={styles.header}>
    {dateLabel && (
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{dateLabel}</Text>
        <SyncDot />
      </View>
    )}
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
    paddingTop: 8,
    paddingBottom: 14,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  eyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 10.5,
    color: tokens.mute,
    letterSpacing: 1.5,
    textTransform: "uppercase",
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
