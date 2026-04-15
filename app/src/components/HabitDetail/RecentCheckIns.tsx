import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { format } from "date-fns";
import { complianceColors } from "../getComplianceColor";

export interface RecentCheckInItem {
  id: number;
  timestamp: Date;
  skipped: boolean | null;
}

interface RecentCheckInsProps {
  checkIns: RecentCheckInItem[];
  onRemove: (id: number) => void;
}

/**
 * Collapsible history section: shows a count when collapsed, the full
 * list (with remove) when expanded. Collapsed by default so the slot
 * UI above remains the primary focus.
 */
export const RecentCheckIns = ({ checkIns, onRemove }: RecentCheckInsProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleRemove = (id: number) => {
    Alert.alert("Remove Check-in", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onRemove(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.headerLabel}>
          Recent check-ins ({checkIns.length})
        </Text>
        <Text style={styles.chevron}>{expanded ? "\u2212" : "+"}</Text>
      </Pressable>

      {expanded && (
        <View>
          {checkIns.length === 0 ? (
            <Text style={styles.emptyText}>No check-ins yet</Text>
          ) : (
            checkIns.map((item) => (
              <View key={item.id} style={styles.row}>
                <View>
                  <Text style={styles.timestamp}>
                    {format(item.timestamp, "EEE, MMM d, yyyy h:mm a")}
                  </Text>
                  {item.skipped && (
                    <Text style={styles.skippedLabel}>(skipped)</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleRemove(item.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  chevron: {
    fontSize: 20,
    fontWeight: "600",
    color: complianceColors.default,
    minWidth: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  timestamp: {
    fontSize: 15,
    color: "#333",
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: complianceColors.failing,
  },
  removeButtonText: {
    color: complianceColors.failing,
    fontSize: 13,
    fontWeight: "600",
  },
  skippedLabel: {
    fontSize: 12,
    color: complianceColors.partial,
    fontWeight: "600",
    marginTop: 2,
  },
});
