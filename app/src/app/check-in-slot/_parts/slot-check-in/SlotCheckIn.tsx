import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HabitGlyph, type HabitIconKind } from "../../../../components/glyphs";
import { tokens } from "../../../../components/theme";

const FONT = "SpaceGrotesk-Bold";
const MONO = "JetBrainsMono";

export type SlotCheckInState = "pending" | "done" | "skip";

export interface SlotCheckInItem {
  id: string;
  title: string;
  /** Icon kind from the habit. May be null / unknown — falls back to the check glyph. */
  icon?: HabitIconKind | string | null;
  /** Cadence / slot detail line (e.g. "7:00 am · 3 sets" or "M·W·F"). */
  slotMeta?: string;
  /** Initial state derived from today's check-ins. */
  initialState: SlotCheckInState;
  /** Wall-clock time the existing check-in was logged at, e.g. "7:04 am". */
  loggedAt?: string;
}

export interface SlotCheckInProps {
  /** Top-eyebrow group label, e.g. "7:00 am". */
  groupTime?: string;
  habits: SlotCheckInItem[];
  onCheckIn: (habitId: string) => void;
  onSkip: (habitId: string) => void;
  onDone: () => void;
  /** Tapped the close × in the top bar. */
  onClose?: () => void;
}

export const SlotCheckIn = ({
  groupTime,
  habits,
  onCheckIn,
  onSkip,
  onDone,
  onClose,
}: SlotCheckInProps) => {
  // Track which rows started resolved at mount — those can't be amended
  // yet (no checkInId to delete) so we lock them. Captured once via
  // useState initializer so live-query updates don't change the lock set.
  const [lockedIds] = useState<Set<string>>(
    () =>
      new Set(
        habits.filter((h) => h.initialState !== "pending").map((h) => h.id),
      ),
  );

  const [states, setStates] = useState<Record<string, SlotCheckInState>>(() =>
    Object.fromEntries(habits.map((h) => [h.id, h.initialState])),
  );

  const cycle = (id: string) => {
    if (lockedIds.has(id)) return;
    setStates((s) => {
      const cur = s[id] ?? "pending";
      const next: SlotCheckInState =
        cur === "pending" ? "done" : cur === "done" ? "skip" : "pending";
      return { ...s, [id]: next };
    });
  };

  const total = habits.length;
  const doneCount = habits.filter((h) => states[h.id] === "done").length;
  const skipCount = habits.filter((h) => states[h.id] === "skip").length;
  const resolved = doneCount + skipCount;
  const allResolved = resolved === total;
  const anyDone = doneCount > 0;
  const anyResolved = resolved > 0;
  const allLockedFromStart = lockedIds.size === total;

  const commit = () => {
    for (const habit of habits) {
      if (lockedIds.has(habit.id)) continue;
      const st = states[habit.id];
      if (st === "done") onCheckIn(habit.id);
      else if (st === "skip") onSkip(habit.id);
    }
    onDone();
  };

  const ctaEnabled = anyResolved || allLockedFromStart;
  const ctaLabel = allLockedFromStart
    ? "back to home"
    : allResolved
      ? "all done"
      : anyDone
        ? `log ${doneCount}, ${total - resolved} pending`
        : "tap a habit to begin";

  const headlineLine1 = allLockedFromStart
    ? skipCount === 0
      ? `all ${total} done.`
      : `${doneCount} done,`
    : `${total} ${total === 1 ? "habit" : "habits"} up,`;
  const headlineLine2 = allLockedFromStart
    ? skipCount === 0
      ? "nice work."
      : `${skipCount} skipped.`
    : anyDone
      ? `${doneCount} down.`
      : "one tap each.";

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose ?? onDone}
          style={styles.closeButton}
          hitSlop={8}
        >
          <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
            <Path
              d="M2 2L9 9M9 2L2 9"
              stroke={tokens.ink}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <NagBadge size={22} />
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.heading}>
        {!!groupTime && (
          <Text style={styles.eyebrow}>{groupTime} · check in</Text>
        )}
        <Text style={styles.headline}>
          {headlineLine1}
          {"\n"}
          {headlineLine2}
        </Text>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          {habits.map((h) => {
            const st = states[h.id] ?? "pending";
            const bg =
              st === "done"
                ? tokens.ink
                : st === "skip"
                  ? tokens.faint
                  : "transparent";
            return (
              <View
                key={h.id}
                style={[styles.progressSegment, { backgroundColor: bg }]}
              />
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.rows}
        contentContainerStyle={styles.rowsContent}
        showsVerticalScrollIndicator={false}
      >
        {habits.map((h) => (
          <CheckInRow
            key={h.id}
            habit={h}
            state={states[h.id] ?? "pending"}
            locked={lockedIds.has(h.id)}
            onPress={() => cycle(h.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!ctaEnabled}
          onPress={commit}
          style={[styles.cta, !ctaEnabled && styles.ctaDisabled]}
        >
          <Text
            style={[styles.ctaLabel, !ctaEnabled && styles.ctaLabelDisabled]}
          >
            {ctaLabel}
          </Text>
          <Text
            style={[styles.ctaCount, !ctaEnabled && styles.ctaCountDisabled]}
          >
            {resolved}/{total}
          </Text>
        </Pressable>
        <Text style={styles.hint}>tap row · pending → done → skip</Text>
      </View>
    </View>
  );
};

interface CheckInRowProps {
  habit: SlotCheckInItem;
  state: SlotCheckInState;
  locked: boolean;
  onPress: () => void;
}

const CheckInRow = ({ habit, state, locked, onPress }: CheckInRowProps) => {
  const isDone = state === "done";
  const isSkip = state === "skip";
  const resolved = isDone || isSkip;

  const meta =
    habit.loggedAt && isDone
      ? `logged ${habit.loggedAt}`
      : habit.loggedAt && isSkip
        ? `skipped ${habit.loggedAt}`
        : habit.slotMeta;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={[
        rowStyles.row,
        resolved ? rowStyles.rowResolved : null,
        isSkip ? rowStyles.rowSkip : null,
      ]}
    >
      <View
        style={[
          rowStyles.icon,
          { backgroundColor: isDone ? tokens.ink : tokens.inkTint },
        ]}
      >
        {isDone ? (
          <CheckGlyph size={14} color={tokens.cream} />
        ) : (
          <HabitGlyph
            kind={habit.icon ?? "check"}
            size={19}
            color={tokens.ink}
          />
        )}
      </View>

      <View style={rowStyles.textCol}>
        <Text
          numberOfLines={1}
          style={[rowStyles.title, isSkip && rowStyles.titleSkip]}
        >
          {habit.title.toLowerCase()}
        </Text>
        {!!meta && <Text style={rowStyles.meta}>{meta}</Text>}
      </View>

      <StatePill state={state} />
    </Pressable>
  );
};

const StatePill = ({ state }: { state: SlotCheckInState }) => {
  if (state === "done") {
    return (
      <View style={pillStyles.done}>
        <CheckGlyph size={9} color={tokens.cream} />
        <Text style={pillStyles.doneLabel}>done</Text>
      </View>
    );
  }
  if (state === "skip") {
    return (
      <View style={pillStyles.skip}>
        <Text style={pillStyles.skipLabel}>skipped</Text>
      </View>
    );
  }
  return <View style={pillStyles.pending} />;
};

interface CheckGlyphProps {
  size: number;
  color: string;
}

/**
 * The compact check-mark stroke used in row icons and the "done" pill.
 * Path is normalised to a 0–9 viewBox; scale via `size`.
 */
const CheckGlyph = ({ size, color }: CheckGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 9 9" fill="none">
    <Path
      d="M2 4.5L4 6.5L7.5 2.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const NagBadge = ({ size = 22 }: { size?: number }) => (
  <View
    style={[
      badgeStyles.box,
      { width: size, height: size, borderRadius: size * 0.27 },
    ]}
  >
    <Text style={[badgeStyles.letter, { fontSize: size * 0.55 }]}>
      n<Text style={{ color: tokens.orange }}>.</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.cream,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(26,20,16,0.045)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarSpacer: {
    width: 32,
  },
  heading: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  eyebrow: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: tokens.mute,
    marginBottom: 6,
  },
  headline: {
    fontFamily: FONT,
    fontSize: 26,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.65,
    lineHeight: 30,
  },
  progressWrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.veryFaint,
    flexDirection: "row",
    gap: 2,
    overflow: "hidden",
  },
  progressSegment: {
    flex: 1,
    borderRadius: 2,
  },
  rows: {
    flex: 1,
  },
  rowsContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: tokens.ink,
    borderRadius: 16,
  },
  ctaDisabled: {
    backgroundColor: "rgba(26,20,16,0.08)",
  },
  ctaLabel: {
    fontFamily: FONT,
    fontSize: 15.5,
    fontWeight: "600",
    letterSpacing: -0.08,
    color: tokens.cream,
  },
  ctaLabelDisabled: {
    color: tokens.mute,
  },
  ctaCount: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: tokens.cream,
    opacity: 0.7,
  },
  ctaCountDisabled: {
    color: tokens.mute,
    opacity: 1,
  },
  hint: {
    textAlign: "center",
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: tokens.mute,
    marginTop: 12,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
  },
  rowResolved: {
    borderColor: tokens.veryFaint,
  },
  rowSkip: {
    opacity: 0.55,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONT,
    fontSize: 15.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.08,
  },
  titleSkip: {
    textDecorationLine: "line-through",
    textDecorationColor: tokens.faint,
  },
  meta: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.mute,
    marginTop: 2,
  },
});

const pillStyles = StyleSheet.create({
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    backgroundColor: tokens.ink,
    borderRadius: 999,
  },
  doneLabel: {
    fontFamily: MONO,
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    fontWeight: "600",
    color: tokens.cream,
  },
  skip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: tokens.faint,
  },
  skipLabel: {
    fontFamily: MONO,
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    fontWeight: "500",
    color: tokens.mute,
  },
  pending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tokens.faint,
  },
});

const badgeStyles = StyleSheet.create({
  box: {
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontFamily: FONT,
    fontWeight: "700",
    color: tokens.cream,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
});
