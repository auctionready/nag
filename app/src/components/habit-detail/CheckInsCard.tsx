import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { format } from "date-fns";
import { isSameCalendarDay } from "@nag/core";
import { tokens } from "../../components/theme";
import type { RecentCheckInItem } from "./types";

interface CheckInsCardProps {
  /** Pre-filtered to the window the eyebrow describes. */
  checkIns: RecentCheckInItem[];
  /** Eyebrow above the list — e.g. "today · check-ins", "wed · apr 30 · check-ins". */
  eyebrow: string;
  /** True when scoped to a single calendar day; controls timestamp format. */
  singleDay: boolean;
  onRemove: (id: string) => void;
  onEditTimestamp?: (id: string, timestamp: Date) => void;
}

const TIME_ONLY = "h:mm a";
const FULL_FMT = "EEE, MMM d, yyyy h:mm a";
const BACKFILL_THRESHOLD_MS = 60_000;
const EDITED_THRESHOLD_MS = 1_000;

const wasBackFilled = ({ timestamp, createdAt }: RecentCheckInItem) =>
  Math.abs(createdAt.getTime() - timestamp.getTime()) >= BACKFILL_THRESHOLD_MS;

const wasEdited = ({ createdAt, updatedAt }: RecentCheckInItem) =>
  updatedAt.getTime() - createdAt.getTime() >= EDITED_THRESHOLD_MS;

const recordedFmt = (deemed: Date, recorded: Date): string => {
  if (isSameCalendarDay(deemed, recorded)) return TIME_ONLY;
  if (deemed.getFullYear() !== recorded.getFullYear()) return FULL_FMT;
  if (deemed.getMonth() !== recorded.getMonth()) return "EEE, MMM d, h:mm a";
  return "EEE d, h:mm a";
};

/**
 * The day-scoped "check-ins" panel. Empty days render an inline hint
 * pointing at the long-press affordance on the action footer below.
 * Each row supports two swipes:
 *   • Swipe left  → DELETE (orange)
 *   • Swipe right → EDIT   (ink)
 */
export const CheckInsCard = ({
  checkIns,
  eyebrow,
  singleDay,
  onRemove,
  onEditTimestamp,
}: CheckInsCardProps) => {
  const fmt = singleDay ? TIME_ONLY : FULL_FMT;

  const handleRemove = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(id);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.counter}>
          {checkIns.length} {checkIns.length === 1 ? "entry" : "entries"}
        </Text>
      </View>
      {checkIns.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHeadline}>nothing logged this day.</Text>
          <Text style={styles.emptyHint}>
            long-press <Text style={styles.emptyHintInk}>Check-in</Text> to
            back-fill
          </Text>
        </View>
      ) : (
        checkIns.map((item, i) => (
          <CheckInRow
            key={item.id}
            entry={item}
            last={i === checkIns.length - 1}
            fmt={fmt}
            onRemove={() => handleRemove(item.id)}
            onEdit={
              onEditTimestamp
                ? () => onEditTimestamp(item.id, item.timestamp)
                : undefined
            }
          />
        ))
      )}
    </View>
  );
};

interface CheckInRowProps {
  entry: RecentCheckInItem;
  last: boolean;
  fmt: string;
  onRemove: () => void;
  onEdit?: () => void;
}

const CheckInRow = ({
  entry,
  last,
  fmt,
  onRemove,
  onEdit,
}: CheckInRowProps) => {
  const isSkipped = entry.skipped === true;
  const showRecorded = wasBackFilled(entry);
  const showEdited = wasEdited(entry);

  return (
    <Swipeable
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        onEdit
          ? () => (
              <Pressable
                onPress={onEdit}
                style={styles.editAction}
                accessibilityRole="button"
                accessibilityLabel="Edit check-in"
              >
                <EditGlyph color={tokens.cream} />
                <Text style={styles.editLabel}>edit</Text>
              </Pressable>
            )
          : undefined
      }
      renderRightActions={() => (
        <Pressable
          onPress={onRemove}
          style={styles.deleteAction}
          accessibilityRole="button"
          accessibilityLabel="Remove check-in"
        >
          <TrashGlyph color={tokens.cream} />
          <Text style={styles.deleteLabel}>delete</Text>
        </Pressable>
      )}
      containerStyle={[styles.swipeContainer, last && styles.swipeLast]}
    >
      <View
        style={styles.row}
        accessibilityActions={[
          { name: "remove", label: "Remove check-in" },
          ...(onEdit ? [{ name: "edit", label: "Edit check-in time" }] : []),
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "remove") onRemove();
          else if (e.nativeEvent.actionName === "edit") onEdit?.();
        }}
      >
        <View style={[styles.swatch, isSkipped && styles.swatchSkipped]}>
          {isSkipped ? (
            <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
              <Path
                d="M2.5 8.5L8.5 2.5"
                stroke={tokens.mute}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
              <Path
                d="M2 5.5L4.5 8L9 3"
                stroke={tokens.cream}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.timestamp}>{format(entry.timestamp, fmt)}</Text>
          <Text style={styles.subline} numberOfLines={1}>
            {isSkipped ? "(skipped)" : "logged"}
          </Text>
          {showEdited ? (
            <Text style={styles.metaLine}>
              edited{" "}
              {format(
                entry.updatedAt,
                recordedFmt(entry.timestamp, entry.updatedAt),
              )}
            </Text>
          ) : showRecorded ? (
            <Text style={styles.metaLine}>
              recorded{" "}
              {format(
                entry.createdAt,
                recordedFmt(entry.timestamp, entry.createdAt),
              )}
            </Text>
          ) : null}
        </View>
        <Text style={styles.swipeHint}>‹ swipe ›</Text>
      </View>
    </Swipeable>
  );
};

const EditGlyph = ({ color }: { color: string }) => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={color}
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M9 2.5l2.5 2.5L4.5 12 2 12.5l.5-2.5L9 2.5z" />
  </Svg>
);

const TrashGlyph = ({ color }: { color: string }) => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={color}
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2.5 3.5h9M5 3.5V2.5h4v1M3.5 3.5L4 12h6l.5-8.5M5.5 6v4M8.5 6v4" />
  </Svg>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  eyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  counter: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 22,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: tokens.veryFaint,
  },
  emptyHeadline: {
    fontSize: 13,
    color: tokens.mute,
  },
  emptyHint: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  emptyHintInk: {
    color: tokens.ink,
    fontWeight: "700",
  },
  swipeContainer: {
    borderTopWidth: 1,
    borderTopColor: tokens.veryFaint,
    backgroundColor: tokens.surface,
  },
  swipeLast: {
    // No-op marker for clarity; the container border handles the divider.
  },
  row: {
    backgroundColor: tokens.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSkipped: {
    backgroundColor: tokens.inkTint,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timestamp: {
    fontFamily: "JetBrainsMono",
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
  },
  subline: {
    fontFamily: "JetBrainsMono",
    fontSize: 10.5,
    color: tokens.mute,
    letterSpacing: 0.2,
  },
  metaLine: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.78,
  },
  swipeHint: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  editAction: {
    width: 88,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  editLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.cream,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  deleteAction: {
    width: 88,
    backgroundColor: tokens.orange,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  deleteLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.cream,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
