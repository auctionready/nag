import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import { format } from "date-fns";
import { isSameCalendarDay } from "@nag/core";
import { EditGlyph, TrashGlyph } from "../../components/glyphs";
import { tokens } from "../../components/theme";
import { timeToken } from "../../components/formatters";
import { use24HourClock } from "../../infrastructure/preferences";
import type { RecentCheckInItem } from "./types";

interface CheckInRowProps {
  entry: RecentCheckInItem;
  last: boolean;
  fmt: string;
  /** True when this check-in lands on a day the habit isn't scheduled for. */
  offDay?: boolean;
  onRemove: () => void;
  onEdit?: () => void;
}

const BACKFILL_THRESHOLD_MS = 60_000;
const EDITED_THRESHOLD_MS = 1_000;

const wasBackFilled = ({ timestamp, createdAt }: RecentCheckInItem) =>
  Math.abs(createdAt.getTime() - timestamp.getTime()) >= BACKFILL_THRESHOLD_MS;

const wasEdited = ({ createdAt, updatedAt }: RecentCheckInItem) =>
  updatedAt.getTime() - createdAt.getTime() >= EDITED_THRESHOLD_MS;

const recordedFmt = (deemed: Date, recorded: Date, time: string): string => {
  if (isSameCalendarDay(deemed, recorded)) return time;
  if (deemed.getFullYear() !== recorded.getFullYear())
    return `EEE, MMM d, yyyy ${time}`;
  if (deemed.getMonth() !== recorded.getMonth()) return `EEE, MMM d, ${time}`;
  return `EEE d, ${time}`;
};

/**
 * One swipeable row inside `CheckInsCard`: ink/mute swatch on the left
 * (check or slash depending on skip state), timestamp + "logged" /
 * "(skipped)" subline, and optional `recorded …` / `edited …` meta line
 * when the deemed time differs from the wall-clock time.
 *
 * Swipe left → delete (orange); swipe right → edit (ink). The hint
 * caption inside the row gives keyboard / screen-reader users a verbal
 * cue too.
 */
export const CheckInRow = ({
  entry,
  last,
  fmt,
  offDay,
  onRemove,
  onEdit,
}: CheckInRowProps) => {
  const isSkipped = entry.skipped === true;
  // A check-in on a day the habit wasn't scheduled reads as an off-day
  // check-in rather than a plain "logged" entry. Skips keep their own subline.
  const subline = isSkipped
    ? "(skipped)"
    : offDay
      ? "off-day check-in"
      : "logged";
  const showRecorded = wasBackFilled(entry);
  const showEdited = wasEdited(entry);
  const time = timeToken(use24HourClock());

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
          {isSkipped ? <SwatchSlashGlyph /> : <SwatchCheckGlyph />}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.timestamp}>{format(entry.timestamp, fmt)}</Text>
          <Text style={styles.subline} numberOfLines={1}>
            {subline}
          </Text>
          {showEdited ? (
            <Text style={styles.metaLine}>
              edited{" "}
              {format(
                entry.updatedAt,
                recordedFmt(entry.timestamp, entry.updatedAt, time),
              )}
            </Text>
          ) : showRecorded ? (
            <Text style={styles.metaLine}>
              recorded{" "}
              {format(
                entry.createdAt,
                recordedFmt(entry.timestamp, entry.createdAt, time),
              )}
            </Text>
          ) : null}
        </View>
        <Text style={styles.swipeHint}>‹ swipe ›</Text>
      </View>
    </Swipeable>
  );
};

// Specialised swatch-sized glyphs — slightly different geometry to the
// shared `glyphs/CheckGlyph` so the icon optically centres inside the
// 28×28 swatch. Kept local to this file since they're not reusable.
const SwatchCheckGlyph = () => (
  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
    <Path
      d="M2 5.5L4.5 8L9 3"
      stroke={tokens.cream}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SwatchSlashGlyph = () => (
  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
    <Path
      d="M2.5 8.5L8.5 2.5"
      stroke={tokens.mute}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Svg>
);

const styles = StyleSheet.create({
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
