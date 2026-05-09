import { LayoutAnimation, StyleSheet, Text, View } from "react-native";
import { tokens } from "../../components/theme";
import { CheckInRow } from "./CheckInRow";
import type { RecentCheckInItem } from "./types";

interface CheckInsCardProps {
  /** Pre-filtered to the window the eyebrow describes. */
  checkIns: RecentCheckInItem[];
  /** Eyebrow above the list — e.g. "today · check-ins", "wed · apr 30 · check-ins". */
  eyebrow: string;
  /** True when scoped to a single calendar day; controls timestamp format. */
  singleDay: boolean;
  /**
   * True when scheduled time-slot pills are visible above the list — the
   * empty-state hint then points at the pills as the primary way to log
   * for a specific moment, alongside the Check-in long-press.
   */
  hasScheduleSlots?: boolean;
  onRemove: (id: string) => void;
  onEditTimestamp?: (id: string, timestamp: Date) => void;
}

const TIME_ONLY = "h:mm a";
const FULL_FMT = "EEE, MMM d, yyyy h:mm a";

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
  hasScheduleSlots,
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
          {hasScheduleSlots && (
            <Text style={styles.emptyHint}>
              tap a <Text style={styles.emptyHintInk}>scheduled slot</Text>{" "}
              above to log it
            </Text>
          )}
          <Text style={styles.emptyHint}>
            {hasScheduleSlots ? "or " : ""}long-press{" "}
            <Text style={styles.emptyHintInk}>Check-in</Text> to back-fill
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
});
