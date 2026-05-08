import { useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { format } from "date-fns";
import { isSameCalendarDay } from "@nag/core";
import { complianceColors } from "../../../../components/compliance";

export interface RecentCheckInItem {
  id: string;
  /** Deemed slot time — what the check-in is credited to. */
  timestamp: Date;
  /** Wall-clock insert time. Differs from `timestamp` for back-filled check-ins. */
  createdAt: Date;
  /** Last modification time. Greater than `createdAt` when the timestamp was edited. */
  updatedAt: Date;
  skipped: boolean | null;
}

interface RecentCheckInsProps {
  /** Pre-filtered to the window the title describes. */
  checkIns: RecentCheckInItem[];
  /** e.g. "This Week's Check-ins", "Wednesday's Check-ins". */
  title: string;
  /** True when the list is scoped to a single calendar day; controls timestamp format. */
  singleDay: boolean;
  onRemove: (id: string) => void;
  onEditTimestamp?: (id: string, timestamp: Date) => void;
}

const TIME_ONLY = "h:mm a";
const FULL_FMT = "EEE, MMM d, yyyy h:mm a";

// Both `timestamp` and `createdAt` default to near-simultaneous `new Date()`
// calls, so fresh check-ins differ by microseconds. User-driven back-fills
// (long-press a missed slot, footer check-in on a non-today selected day)
// put them minutes to hours apart. 60s is a comfortable threshold.
const BACKFILL_THRESHOLD_MS = 60_000;
const wasBackFilled = ({ timestamp, createdAt }: RecentCheckInItem) =>
  Math.abs(createdAt.getTime() - timestamp.getTime()) >= BACKFILL_THRESHOLD_MS;

const EDITED_THRESHOLD_MS = 1_000;
const wasEdited = ({ createdAt, updatedAt }: RecentCheckInItem) =>
  updatedAt.getTime() - createdAt.getTime() >= EDITED_THRESHOLD_MS;

/** Pick the shortest format that still communicates the difference. */
const recordedFmt = (deemed: Date, recorded: Date): string => {
  if (isSameCalendarDay(deemed, recorded)) return TIME_ONLY;
  if (deemed.getFullYear() !== recorded.getFullYear()) return FULL_FMT;
  if (deemed.getMonth() !== recorded.getMonth()) return "EEE, MMM d, h:mm a";
  return "EEE d, h:mm a"; // same month+year, different day
};

/**
 * Period-scoped check-in list. Each row supports two swipe actions:
 *   • Swipe left  → Remove (red)
 *   • Swipe right → Edit   (blue, only when onEditTimestamp is wired)
 */
export const RecentCheckIns = ({
  checkIns,
  title,
  singleDay,
  onRemove,
  onEditTimestamp,
}: RecentCheckInsProps) => {
  const [expanded, setExpanded] = useState(true);

  const fmt = singleDay ? TIME_ONLY : FULL_FMT;

  const handleRemove = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(id);
  };

  const renderRightActions = (id: string) => (
    <Pressable
      onPress={() => handleRemove(id)}
      style={styles.removeAction}
      accessibilityRole="button"
      accessibilityLabel="Remove check-in"
    >
      <Text style={styles.swipeActionText}>Remove</Text>
    </Pressable>
  );

  const renderLeftActions = (id: string, timestamp: Date) => {
    if (!onEditTimestamp) return null;
    return (
      <Pressable
        onPress={() => onEditTimestamp(id, timestamp)}
        style={styles.editAction}
        accessibilityRole="button"
        accessibilityLabel="Edit check-in"
      >
        <Text style={styles.swipeActionText}>Edit</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.headerLabel}>
          {title} ({checkIns.length})
        </Text>
        <Text style={styles.chevron}>{expanded ? "\u2212" : "+"}</Text>
      </Pressable>

      {expanded && (
        <View>
          {checkIns.length === 0 ? (
            <Text style={styles.emptyText}>No check-ins yet</Text>
          ) : (
            checkIns.map((item) => (
              <Swipeable
                key={item.id}
                friction={2}
                leftThreshold={40}
                rightThreshold={40}
                overshootLeft={false}
                overshootRight={false}
                renderLeftActions={() =>
                  renderLeftActions(item.id, item.timestamp)
                }
                renderRightActions={() => renderRightActions(item.id)}
                containerStyle={styles.swipeContainer}
              >
                <View
                  style={styles.row}
                  accessibilityActions={[
                    { name: "remove", label: "Remove check-in" },
                    ...(onEditTimestamp
                      ? [{ name: "edit", label: "Edit check-in time" }]
                      : []),
                  ]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === "remove") {
                      handleRemove(item.id);
                    } else if (e.nativeEvent.actionName === "edit") {
                      onEditTimestamp?.(item.id, item.timestamp);
                    }
                  }}
                >
                  <Text style={styles.timestamp}>
                    {format(item.timestamp, fmt)}
                  </Text>
                  {wasEdited(item) ? (
                    <Text style={styles.recordedLabel}>
                      (edited{" "}
                      {format(
                        item.updatedAt,
                        recordedFmt(item.timestamp, item.updatedAt),
                      )}
                      )
                    </Text>
                  ) : wasBackFilled(item) ? (
                    <Text style={styles.recordedLabel}>
                      (recorded{" "}
                      {format(
                        item.createdAt,
                        recordedFmt(item.timestamp, item.createdAt),
                      )}
                      )
                    </Text>
                  ) : null}
                  {item.skipped && (
                    <Text style={styles.skippedLabel}>(skipped)</Text>
                  )}
                </View>
              </Swipeable>
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
  // Divider lives on the Swipeable container so it spans both the row content
  // and any revealed action panels.
  swipeContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  row: {
    // Opaque so action colours don't bleed through while swiping.
    backgroundColor: "#fff",
    paddingVertical: 12,
  },
  timestamp: {
    fontSize: 15,
    color: "#333",
  },
  recordedLabel: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  editAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    backgroundColor: "#007AFF",
  },
  removeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    backgroundColor: complianceColors.failing,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  skippedLabel: {
    fontSize: 12,
    color: complianceColors.partial,
    fontWeight: "600",
    marginTop: 2,
  },
});
