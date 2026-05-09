import { StyleSheet, Text, View } from "react-native";
import type { TimeSlotStatus } from "@nag/core";
import { tokens } from "../../components/theme";
import { SlotPill, type SlotState } from "./SlotPill";

interface SlotEntry {
  hour: number;
  minute: number;
  status: TimeSlotStatus;
}

interface SlotsCardProps {
  /** Eyebrow above the row — e.g. "today · schedule", "wed · apr 30 · schedule". */
  eyebrow: string;
  slots: SlotEntry[];
  /**
   * `now` for the selected day. Time-slots whose moment has passed without
   * a check-in are tagged `owed`; later upcoming slots stay `pending`.
   * The parent supplies the per-slot status from `matchCheckInsToTimeSlots`.
   */
  isToday: boolean;
  onLongPressSlot?: (hour: number, minute: number) => void;
}

/**
 * Compact tiled-pill row of the day's scheduled slots. Hidden by the
 * caller when `slots` is empty (frequency-only / off-day habits).
 */
export const SlotsCard = ({
  eyebrow,
  slots,
  isToday,
  onLongPressSlot,
}: SlotsCardProps) => {
  if (slots.length === 0) return null;
  const doneN = slots.filter((s) => s.status === "done").length;

  // The first `upcoming` slot today is back-fillable too — lets the user
  // record "I'm doing it now" a few minutes ahead. After today's strip,
  // upcoming stays passive so users don't accidentally back-fill the future.
  const firstUpcomingIdx = isToday
    ? slots.findIndex((s) => s.status === "upcoming")
    : -1;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.counter}>
          {doneN} / {slots.length}
        </Text>
      </View>
      <View style={styles.pillsRow}>
        {slots.map((slot, i) => {
          const slotState = mapStatus(slot.status);
          const backfillable =
            slot.status === "missed" || i === firstUpcomingIdx;
          return (
            <SlotPill
              key={`${slot.hour}:${slot.minute}:${i}`}
              hour={slot.hour}
              minute={slot.minute}
              state={slotState}
              onLongPress={
                backfillable && onLongPressSlot
                  ? () => onLongPressSlot(slot.hour, slot.minute)
                  : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
};

const mapStatus = (status: TimeSlotStatus): SlotState => {
  switch (status) {
    case "done":
      return "done";
    case "skipped":
      return "skipped";
    case "missed":
      return "owed";
    case "upcoming":
    default:
      return "pending";
  }
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
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
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
