import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { format } from "date-fns";
import { complianceColors } from "../getComplianceColor";

export interface RecentCheckInItem {
  id: number;
  /** Deemed slot time — what the check-in is credited to. */
  timestamp: Date;
  /** Wall-clock insert time. Differs from `timestamp` for back-filled check-ins. */
  createdAt: Date;
  skipped: boolean | null;
}

interface RecentCheckInsProps {
  /** Pre-filtered to the window the title describes. */
  checkIns: RecentCheckInItem[];
  /** e.g. "This Week's Check-ins", "Wednesday's Check-ins". */
  title: string;
  /** True when the list is scoped to a single calendar day; controls timestamp format. */
  singleDay: boolean;
  onRemove: (id: number) => void;
}

const TIME_ONLY = "h:mm a";
const FULL_FMT = "EEE, MMM d, yyyy h:mm a";

// Both `timestamp` and `createdAt` default to near-simultaneous `new Date()`
// calls, so fresh check-ins differ by microseconds. User-driven back-fills
// (long-press a missed slot, footer check-in on a non-today selected day)
// put them minutes to hours apart. 60s is a comfortable threshold.
const BACKFILL_THRESHOLD_MS = 60_000;
const wasBackFilled = (ts: Date, createdAt: Date) =>
  Math.abs(createdAt.getTime() - ts.getTime()) >= BACKFILL_THRESHOLD_MS;

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Period-scoped check-in list: the screen decides the window and title
 * (e.g. "This Week's Check-ins" / "Wednesday's Check-ins"); this component
 * just renders the list with a collapsible header. Expanded by default so
 * the user sees the history without an extra tap.
 *
 * Each row is swipe-left-to-reveal a Remove action (iOS-style). Tapping the
 * revealed action prompts for confirmation via `Alert`; Cancel closes the
 * row back up.
 */
export const RecentCheckIns = ({
  checkIns,
  title,
  singleDay,
  onRemove,
}: RecentCheckInsProps) => {
  const [expanded, setExpanded] = useState(true);
  const swipeableRefs = useRef<Map<number, Swipeable | null>>(new Map());

  const fmt = singleDay ? TIME_ONLY : FULL_FMT;

  const handleRemovePress = (id: number) => {
    Alert.alert("Remove Check-in", "Are you sure?", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => swipeableRefs.current.get(id)?.close(),
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onRemove(id),
      },
    ]);
  };

  const renderRightActions = (id: number) => (
    <Pressable
      onPress={() => handleRemovePress(id)}
      style={styles.swipeAction}
      accessibilityRole="button"
      accessibilityLabel="Remove check-in"
    >
      <Text style={styles.swipeActionText}>Remove</Text>
    </Pressable>
  );

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
                ref={(r) => {
                  swipeableRefs.current.set(item.id, r);
                }}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                renderRightActions={() => renderRightActions(item.id)}
                containerStyle={styles.swipeContainer}
              >
                <View
                  style={styles.row}
                  accessibilityActions={[
                    { name: "remove", label: "Remove check-in" },
                  ]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === "remove") {
                      handleRemovePress(item.id);
                    }
                  }}
                >
                  <Text style={styles.timestamp}>
                    {format(item.timestamp, fmt)}
                  </Text>
                  {wasBackFilled(item.timestamp, item.createdAt) && (
                    <Text style={styles.recordedLabel}>
                      (recorded{" "}
                      {format(
                        item.createdAt,
                        // When the recording happened on a different
                        // calendar day than the deemed slot, always show
                        // the date — otherwise "(recorded 10:00 AM)" below
                        // an 8 AM slot hides the fact that recording
                        // happened on a later day.
                        isSameCalendarDay(item.timestamp, item.createdAt)
                          ? fmt
                          : FULL_FMT,
                      )}
                      )
                    </Text>
                  )}
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
  // Divider lives on the Swipeable container so it spans across both the row
  // and the revealed action.
  swipeContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  row: {
    // Opaque so the red action behind the row doesn't bleed through while
    // swiping.
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
  swipeAction: {
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
