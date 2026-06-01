import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TimeSlotStatus } from "@nag/core";
import { tokens } from "../../../components/theme";
import { TimeSlotPill, type TimeSlotPillState } from "./TimeSlotPill";
import {
  TimeSlotActionsPopover,
  type TimeSlotPillBounds,
  type TimeSlotPopoverMode,
} from "./TimeSlotActionsPopover";

interface TimeSlotEntry {
  hour: number;
  minute: number;
  status: TimeSlotStatus;
  /** Timestamp of the matched check-in/skip, when status is "done" or "skipped". */
  matchedAt?: Date;
}

interface TimeSlotsCardProps {
  /** Eyebrow above the row — e.g. "today · schedule", "wed · apr 30 · schedule". */
  eyebrow: string;
  slots: TimeSlotEntry[];
  /**
   * `now` for the selected day. Time slots whose moment has passed without
   * a check-in are tagged `owed`; later upcoming slots stay `pending`. The
   * parent supplies the per-Time-slot status from
   * `matchCheckInsToTimeSlots`.
   */
  isToday: boolean;
  /** The day these slots belong to (selected day or today) — used to turn
   * a slot's hour/minute into a concrete time for the `maxLogTime` gate. */
  slotDay?: Date;
  /** Latest time a slot may be logged. Slots after this are non-loggable
   * (used for paused habits, capped at `pausedAt`). Undefined = no cap. */
  maxLogTime?: Date | null;
  /** Record a check-in pinned to this Time slot's time. */
  onCheckInForTimeSlot?: (hour: number, minute: number) => void;
  /** Record a skip pinned to this Time slot's time. */
  onSkipForTimeSlot?: (hour: number, minute: number) => void;
  /** Remove the check-in/skip currently paired to this Time slot. */
  onDeleteForTimeSlot?: (matchedAt: Date) => void;
}

/**
 * Compact tiled-pill row of the day's scheduled Time slots. Hidden by
 * the caller when `slots` is empty (frequency-only / off-day habits).
 * Tapping a pill opens the variant-C action popover: `log` mode (check
 * in / skip) for un-paired pills, `delete` mode for pills that already
 * have a check-in or skip.
 */
export const TimeSlotsCard = ({
  eyebrow,
  slots,
  isToday,
  slotDay,
  maxLogTime,
  onCheckInForTimeSlot,
  onSkipForTimeSlot,
  onDeleteForTimeSlot,
}: TimeSlotsCardProps) => {
  // The first `upcoming` Time slot today is back-fillable too — lets the
  // user record "I'm doing it now" a few minutes ahead. After today's
  // strip, upcoming stays passive so users don't accidentally back-fill
  // the future.
  const firstUpcomingIdx = isToday
    ? slots.findIndex((s) => s.status === "upcoming")
    : -1;

  // No check-in handler ⇒ logging is disabled (archived habit). Pills
  // that already have a check-in/skip stay tappable for undo.
  const canLog = onCheckInForTimeSlot != null;

  // A specific slot is loggable when logging is on AND (no cap, or the
  // slot's time is at/before the cap). The cap is `pausedAt` for paused
  // habits, so only slots up to the pause can be back-filled.
  const slotLoggable = (hour: number, minute: number): boolean => {
    if (!canLog) return false;
    if (!maxLogTime || !slotDay) return true;
    const t = new Date(
      slotDay.getFullYear(),
      slotDay.getMonth(),
      slotDay.getDate(),
      hour,
      minute,
      0,
      0,
    );
    return t <= maxLogTime;
  };

  const pillRefs = useRef<Record<number, View | null>>({});
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<TimeSlotPillBounds | null>(null);

  const dismiss = () => {
    setActiveIdx(null);
    setAnchor(null);
  };

  const openFor = (idx: number) => {
    setActiveIdx(idx);
    setAnchor(null);
    const node = pillRefs.current[idx];
    if (!node) return;
    // measureInWindow is async; the popover stays mounted but invisible
    // until coords arrive (a frame later in production, never in
    // jsdom-style tests — which is fine because tests query buttons by
    // a11y label, not by screen position).
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };

  if (slots.length === 0) return null;
  const doneN = slots.filter((s) => s.status === "done").length;

  const activeTimeSlot = activeIdx != null ? slots[activeIdx] : null;
  const popoverMode: TimeSlotPopoverMode = activeTimeSlot
    ? popoverModeFor(activeTimeSlot.status)
    : "log";

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
          const pillState = mapStatus(slot.status);
          const interactive = isInteractive(
            slot.status,
            i,
            firstUpcomingIdx,
            slotLoggable(slot.hour, slot.minute),
          );
          return (
            <TimeSlotPill
              key={`${slot.hour}:${slot.minute}:${i}`}
              ref={(node) => {
                pillRefs.current[i] = node;
              }}
              hour={slot.hour}
              minute={slot.minute}
              state={pillState}
              active={activeIdx === i}
              onPress={interactive ? () => openFor(i) : undefined}
            />
          );
        })}
      </View>
      <TimeSlotActionsPopover
        visible={activeIdx != null}
        anchor={anchor}
        mode={popoverMode}
        onCheckIn={() => {
          if (activeTimeSlot)
            onCheckInForTimeSlot?.(activeTimeSlot.hour, activeTimeSlot.minute);
        }}
        onSkip={() => {
          if (activeTimeSlot)
            onSkipForTimeSlot?.(activeTimeSlot.hour, activeTimeSlot.minute);
        }}
        onDelete={() => {
          if (activeTimeSlot?.matchedAt)
            onDeleteForTimeSlot?.(activeTimeSlot.matchedAt);
        }}
        onDismiss={dismiss}
      />
    </View>
  );
};

const isInteractive = (
  status: TimeSlotStatus,
  idx: number,
  firstUpcomingIdx: number,
  canLog: boolean,
): boolean => {
  // done/skipped pills open the undo popover regardless of logging.
  if (status === "done" || status === "skipped") return true;
  // missed / upcoming pills only open the log popover when logging is on.
  if (!canLog) return false;
  if (status === "missed") return true;
  return idx === firstUpcomingIdx;
};

const popoverModeFor = (status: TimeSlotStatus): TimeSlotPopoverMode => {
  if (status === "done") return "undo-checkin";
  if (status === "skipped") return "undo-skip";
  return "log";
};

const mapStatus = (status: TimeSlotStatus): TimeSlotPillState => {
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
