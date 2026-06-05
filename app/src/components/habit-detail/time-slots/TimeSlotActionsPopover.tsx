import { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CheckGlyph, SkipGlyph, UndoGlyph } from "../../../components/glyphs";
import { tokens } from "../../../components/theme";

export interface TimeSlotPillBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `log` = nothing recorded yet → check in / skip.
 * `undo-checkin` / `undo-skip` = a check-in or skip is already paired to
 * this Time slot → single danger action whose label matches the
 * recording it will remove.
 */
export type TimeSlotPopoverMode = "log" | "undo-checkin" | "undo-skip";

interface TimeSlotActionsPopoverProps {
  visible: boolean;
  /** Screen-coords bounds of the anchor pill (from `measureInWindow`). */
  anchor: TimeSlotPillBounds | null;
  mode: TimeSlotPopoverMode;
  onCheckIn: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}

/**
 * Floating bubble of primary actions for a tapped Time-slot pill —
 * variant C from the design canvas. Renders inside a transparent Modal
 * so it sits above the rest of the screen; tapping the backdrop or any
 * action dismisses it. Content depends on `mode`: `log` shows
 * check-in / skip; `delete` shows a single danger action to remove the
 * existing pairing.
 */
export const TimeSlotActionsPopover = ({
  visible,
  anchor,
  mode,
  onCheckIn,
  onSkip,
  onDelete,
  onDismiss,
}: TimeSlotActionsPopoverProps) => {
  // Drive the entry animation ourselves (Modal's built-in fade is
  // disabled below) so the popover scales up + rises slightly from its
  // tail position the moment the anchor's bounds arrive. `anchor`
  // becoming non-null is the cue to play. Hooks must run unconditionally
  // — the early `visible` short-circuit lives below them.
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!anchor) {
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [anchor, anim]);

  if (!visible) return null;

  // Centre the bubble horizontally on the pill, place it just above with a
  // small gap for the tail. Width depends on `mode` since `delete` is a
  // single button. Clamped to stay `screenInset` from each edge; the
  // tail re-anchors to the pill's centre so it still points at the right
  // pill even after a clamp. Until the anchor's bounds arrive (one frame
  // after press) we render fully transparent so users don't see the
  // popover flash at (0,0).
  const popoverWidth =
    mode === "undo-checkin" ? 150 : mode === "undo-skip" ? 122 : 170;
  const popoverHeight = 44;
  const tailGap = 8;
  const screenInset = 8;
  const tailHalf = 6;
  const tailMinFromEdge = 16;
  const screenWidth = Dimensions.get("window").width;
  const pillCentreX = anchor ? anchor.x + anchor.width / 2 : 0;
  const idealLeft = pillCentreX - popoverWidth / 2;
  const left = Math.max(
    screenInset,
    Math.min(idealLeft, screenWidth - popoverWidth - screenInset),
  );
  const top = anchor ? anchor.y - popoverHeight - tailGap : 0;
  const tailLeft = Math.max(
    tailMinFromEdge,
    Math.min(
      pillCentreX - left - tailHalf,
      popoverWidth - tailMinFromEdge - tailHalf * 2,
    ),
  );
  const animatedScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const animatedTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 0],
  });
  const animatedOpacity = anchor ? anim : 0;

  return (
    <Modal transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Stop propagation: tapping inside the popover should not dismiss. */}
        <AnimatedPressable
          onPress={() => {}}
          style={[
            styles.popover,
            {
              width: popoverWidth,
              top,
              left,
              opacity: animatedOpacity,
              transform: [
                { translateY: animatedTranslateY },
                { scale: animatedScale },
              ],
            },
          ]}
        >
          {mode === "log" ? (
            <>
              <PopButton
                primary
                label="check in"
                glyph=<CheckGlyph color={tokens.cream} />
                onPress={() => {
                  onCheckIn();
                  onDismiss();
                }}
              />
              <PopButton
                label="skip"
                glyph=<SkipGlyph color={tokens.cream} />
                onPress={() => {
                  onSkip();
                  onDismiss();
                }}
              />
            </>
          ) : (
            <PopButton
              danger
              label={mode === "undo-checkin" ? "undo check-in" : "undo skip"}
              glyph=<UndoGlyph color={tokens.orange} />
              onPress={() => {
                onDelete();
                onDismiss();
              }}
            />
          )}
          {/* Tail: 12×12 rotated square anchored under the active pill's
              centre (clamped so it never escapes the popover's rounded
              corners when the bubble is shifted to stay on-screen). */}
          <View
            pointerEvents="none"
            style={[styles.tail, { left: tailLeft, bottom: -5 }]}
          />
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PopButtonProps {
  label: string;
  glyph: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
  onPress: () => void;
}

const PopButton = ({
  label,
  glyph,
  primary,
  danger,
  onPress,
}: PopButtonProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[
      styles.btn,
      primary && styles.btnPrimary,
      danger && styles.btnDanger,
    ]}
  >
    {glyph}
    <Text style={[styles.btnLabel, danger && styles.btnLabelDanger]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  popover: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.ink,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: tokens.orange,
  },
  btnDanger: {
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  btnLabel: {
    color: tokens.cream,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.06,
  },
  btnLabelDanger: {
    color: tokens.orange,
  },
  tail: {
    position: "absolute",
    width: 12,
    height: 12,
    backgroundColor: tokens.ink,
    transform: [{ rotate: "45deg" }],
  },
});
