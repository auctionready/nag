import { useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  Swipeable,
} from "react-native-gesture-handler";
import { format } from "date-fns";
import { complianceColors } from "../getComplianceColor";

export interface RecentCheckInItem {
  id: number;
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
  onRemove: (id: number) => void;
  onEditTimestamp?: (id: number, timestamp: Date) => void;
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

const EDITED_THRESHOLD_MS = 1_000;
const wasEdited = (createdAt: Date, updatedAt: Date) =>
  updatedAt.getTime() - createdAt.getTime() >= EDITED_THRESHOLD_MS;

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Pick the shortest format that still communicates the difference. */
const recordedFmt = (deemed: Date, recorded: Date): string => {
  if (isSameCalendarDay(deemed, recorded)) return TIME_ONLY;
  if (deemed.getFullYear() !== recorded.getFullYear()) return FULL_FMT;
  if (deemed.getMonth() !== recorded.getMonth()) return "EEE, MMM d, h:mm a";
  return "EEE d, h:mm a"; // same month+year, different day
};

/**
 * Period-scoped check-in list: the screen decides the window and title
 * (e.g. "This Week's Check-ins" / "Wednesday's Check-ins"); this component
 * just renders the list with a collapsible header. Expanded by default so
 * the user sees the history without an extra tap.
 *
 * Each row is swipe-left-to-reveal a Remove action (iOS-style). Tapping the
 * revealed action immediately removes the check-in — two gestures (swipe +
 * tap) is sufficient intent; undo will replace confirmation.
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

  // Schedule a fade+collapse on the next layout pass so the row leaves
  // smoothly and the rows below it slide up rather than snap.
  const handleRemove = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(id);
  };

  const renderRightActions = (id: number) => (
    <Pressable
      onPress={() => handleRemove(id)}
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
            checkIns.map((item) => {
              const longPress = Gesture.LongPress()
                .minDuration(500)
                .enabled(onEditTimestamp != null)
                .onStart(() => {
                  onEditTimestamp?.(item.id, item.timestamp);
                });

              return (
                <Swipeable
                  key={item.id}
                  friction={2}
                  rightThreshold={40}
                  overshootRight={false}
                  renderRightActions={() => renderRightActions(item.id)}
                  containerStyle={styles.swipeContainer}
                >
                  <GestureDetector gesture={longPress}>
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
                      {wasEdited(item.createdAt, item.updatedAt) ? (
                        <Text style={styles.recordedLabel}>
                          (edited{" "}
                          {format(
                            item.updatedAt,
                            recordedFmt(item.timestamp, item.updatedAt),
                          )}
                          )
                        </Text>
                      ) : wasBackFilled(item.timestamp, item.createdAt) ? (
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
                  </GestureDetector>
                </Swipeable>
              );
            })
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
