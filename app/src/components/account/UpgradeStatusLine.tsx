import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import type { UpgradeStatus } from "./types";

export const UpgradeStatusLine = ({ status }: { status: UpgradeStatus }) => {
  switch (status.kind) {
    case "idle":
      return null;
    case "in-progress":
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator color={tokens.ink} />
          <Text style={styles.statusText}>linking your account…</Text>
        </View>
      );
    case "ok":
      return null;
    case "fail":
      return (
        <View style={styles.statusErrorBox}>
          <Text style={styles.statusErrorText} numberOfLines={4}>
            Could not link account: {status.message}
          </Text>
        </View>
      );
  }
};

const styles = StyleSheet.create({
  statusRow: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: tokens.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 13,
    color: tokens.mute,
  },
  statusErrorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,90,54,0.1)",
    borderRadius: 12,
  },
  statusErrorText: {
    fontSize: 13,
    color: tokens.orange,
  },
});
