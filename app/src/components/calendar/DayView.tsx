import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatTimeSlotTime, formatTimeOfDay } from "@nag/core";
import { tokens } from "../theme";
import { HabitGlyph } from "../glyphs";
import type { DayAgenda, DayAgendaItem } from "./useCalendarData";

interface DayViewProps {
  day: Date;
  agenda: DayAgenda;
  /**
   * Called when the user taps the check button on an actionable row.
   * `backfillAt` is set for past-day or scheduled-slot rows so the
   * caller can record the check-in at the slot's exact time. For
   * today's overdue/upcoming rows it's omitted (use now).
   */
  onCheckIn: (item: DayAgendaItem, backfillAt: Date | null) => void;
  onSkip: (item: DayAgendaItem, backfillAt: Date | null) => void;
  /** Called when the user wants to undo an already-logged check-in. */
  onUndo: (item: DayAgendaItem) => void;
}

/**
 * Day-view agenda. Groups items into four sections:
 *   - Needs you (overdue, accent)
 *   - Later today (upcoming, soft)
 *   - Scheduled (future-day, read-only)
 *   - Logged (done / skip / missed) — labelled "Record" on past days
 *
 * Actionable on today and past days; future days are read-only per the
 * design — but check-in is still allowed on missed past-day slots so the
 * user can backfill what they forgot.
 */
export const DayView = ({
  day,
  agenda,
  onCheckIn,
  onSkip,
  onUndo,
}: DayViewProps) => {
  const { items, mode } = agenda;
  const by = (...st: DayAgendaItem["status"][]) =>
    items.filter((i) => st.includes(i.status));
  const overdue = by("overdue");
  const upcoming = by("upcoming");
  const scheduled = by("scheduled");
  const logged = by("done", "skip", "missed");

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          Nothing on the agenda for this day.
        </Text>
      </View>
    );
  }

  const backfillFor = (item: DayAgendaItem): Date | null => {
    if (mode === "today") return null;
    if (item.slotHour === undefined || item.slotMinute === undefined) {
      return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0);
    }
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      item.slotHour,
      item.slotMinute,
    );
  };

  return (
    <View style={styles.container}>
      {overdue.length > 0 && (
        <Section label="Needs you" count={overdue.length} accent>
          {overdue.map((item) => (
            <ActionRow
              key={item.key}
              item={item}
              tone="orange"
              primary
              onCheckIn={() => onCheckIn(item, backfillFor(item))}
              onSkip={() => onSkip(item, backfillFor(item))}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label="Later today" count={upcoming.length}>
          {upcoming.map((item) => (
            <ActionRow
              key={item.key}
              item={item}
              tone="soft"
              primary={false}
              onCheckIn={() => onCheckIn(item, backfillFor(item))}
              onSkip={() => onSkip(item, backfillFor(item))}
            />
          ))}
        </Section>
      )}

      {scheduled.length > 0 && (
        <Section label="Scheduled" count={scheduled.length}>
          <View style={styles.cardGroup}>
            {scheduled.map((item, i) => (
              <ScheduledRow
                key={item.key}
                item={item}
                last={i === scheduled.length - 1}
              />
            ))}
          </View>
        </Section>
      )}

      {logged.length > 0 && (
        <Section
          label={mode === "past" ? "Record" : "Logged today"}
          count={logged.length}
        >
          <View style={styles.cardGroup}>
            {logged.map((item, i) => (
              <LoggedRow
                key={item.key}
                item={item}
                last={i === logged.length - 1}
                actionable={mode !== "future"}
                onCheckIn={() => onCheckIn(item, backfillFor(item))}
                onUndo={() => onUndo(item)}
              />
            ))}
          </View>
        </Section>
      )}
    </View>
  );
};

// ── Section eyebrow ──────────────────────────────────────────────

interface SectionProps {
  label: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}

const Section = ({ label, count, accent, children }: SectionProps) => (
  <View style={styles.section}>
    <View style={styles.eyebrowRow}>
      <Text style={[styles.eyebrow, accent && styles.eyebrowAccent]}>
        {label}
      </Text>
      <View style={[styles.countPill, accent && styles.countPillAccent]}>
        <Text style={[styles.countLabel, accent && styles.countLabelAccent]}>
          {count}
        </Text>
      </View>
      <View style={styles.eyebrowRule} />
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

// ── Action row (overdue / upcoming) ──────────────────────────────

interface ActionRowProps {
  item: DayAgendaItem;
  tone: "orange" | "soft";
  primary: boolean;
  onCheckIn: () => void;
  onSkip: () => void;
}

const slotMeta = (item: DayAgendaItem): string | undefined => {
  if (item.slotHour === undefined || item.slotMinute === undefined)
    return undefined;
  return formatTimeSlotTime(item.slotHour, item.slotMinute);
};

const ActionRow = ({
  item,
  tone,
  primary,
  onCheckIn,
  onSkip,
}: ActionRowProps) => (
  <View style={[styles.actionRow, tone === "orange" && styles.actionRowOrange]}>
    <View
      style={[
        styles.iconTile,
        tone === "orange" ? styles.iconTileOrange : styles.iconTileSoft,
      ]}
    >
      <HabitGlyph
        kind={item.habitIcon ?? "check"}
        size={17}
        color={tone === "orange" ? tokens.orange : tokens.ink}
        style="line"
      />
    </View>
    <View style={styles.actionTextCol}>
      <View style={styles.actionTitleRow}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {item.habitTitle}
        </Text>
        {item.status === "overdue" && (
          <View style={styles.overduePill}>
            <Text style={styles.overduePillText}>overdue</Text>
          </View>
        )}
      </View>
      {slotMeta(item) && (
        <Text style={styles.actionMeta}>{slotMeta(item)}</Text>
      )}
    </View>
    <View style={styles.actionBtns}>
      <Pressable
        onPress={onSkip}
        style={styles.skipBtn}
        accessibilityRole="button"
        accessibilityLabel={`Skip ${item.habitTitle}`}
      >
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
          <Path
            d="M4 4l8 8M12 4l-8 8"
            stroke={tokens.mute}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
      <Pressable
        onPress={onCheckIn}
        style={[styles.checkBtn, primary && styles.checkBtnPrimary]}
        accessibilityRole="button"
        accessibilityLabel={`Check in ${item.habitTitle}`}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M3 8.4L6.4 11.8L13 5"
            stroke={primary ? tokens.cream : tokens.ink}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </View>
  </View>
);

// ── Scheduled row (future, read-only) ────────────────────────────

interface ScheduledRowProps {
  item: DayAgendaItem;
  last: boolean;
}

const ScheduledRow = ({ item, last }: ScheduledRowProps) => (
  <View style={[styles.staticRow, !last && styles.staticRowDivider]}>
    <View style={styles.staticStateGlyph}>
      <HabitGlyph
        kind={item.habitIcon ?? "check"}
        size={12}
        color={tokens.mute}
        style="line"
      />
    </View>
    <View style={styles.staticTextCol}>
      <Text style={styles.staticTitle} numberOfLines={1}>
        {item.habitTitle}
      </Text>
    </View>
    {slotMeta(item) && <Text style={styles.staticMeta}>{slotMeta(item)}</Text>}
  </View>
);

// ── Logged row (done / skip / missed) ────────────────────────────

interface LoggedRowProps {
  item: DayAgendaItem;
  last: boolean;
  actionable: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
}

const LoggedRow = ({
  item,
  last,
  actionable,
  onCheckIn,
  onUndo,
}: LoggedRowProps) => {
  const isDone = item.status === "done";
  const isMissed = item.status === "missed";
  const isSkip = item.status === "skip";

  return (
    <View style={[styles.staticRow, !last && styles.staticRowDivider]}>
      <View
        style={[
          styles.loggedStateGlyph,
          isDone && styles.loggedStateGlyphDone,
          isMissed && styles.loggedStateGlyphMissed,
          isSkip && styles.loggedStateGlyphSkip,
        ]}
      >
        {isDone && (
          <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
            <Path
              d="M2.5 6.2L5 8.7L9.5 3.8"
              stroke={tokens.cream}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
        {isMissed && (
          <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
            <Path
              d="M3 3l6 6M9 3l-6 6"
              stroke={tokens.orange}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        )}
        {isSkip && (
          <Svg width={9} height={9} viewBox="0 0 12 12" fill="none">
            <Path
              d="M3 9L9 3"
              stroke={tokens.mute}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          </Svg>
        )}
      </View>
      <View style={styles.loggedTextCol}>
        <Text
          style={[styles.loggedTitle, isSkip && styles.loggedTitleSkip]}
          numberOfLines={1}
        >
          {item.habitTitle}
        </Text>
        {slotMeta(item) && (
          <Text style={styles.loggedSlot}>{slotMeta(item)}</Text>
        )}
      </View>
      <Text style={[styles.loggedMeta, isMissed && styles.loggedMetaMissed]}>
        {isMissed
          ? "missed"
          : item.loggedAt
            ? formatTimeOfDay(item.loggedAt)
            : ""}
      </Text>
      {isMissed && actionable && (
        <Pressable
          onPress={onCheckIn}
          style={styles.reopenBtn}
          accessibilityRole="button"
          accessibilityLabel={`Log ${item.habitTitle} now`}
        >
          <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
            <Path
              d="M2.5 7.2L5.5 10.2L11.5 4"
              stroke={tokens.ink}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}
      {(isDone || isSkip) && actionable && item.checkInId && (
        <Pressable
          onPress={onUndo}
          style={styles.reopenBtn}
          accessibilityRole="button"
          accessibilityLabel={`Undo ${item.habitTitle}`}
          hitSlop={6}
        >
          <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
            <Path
              d="M3 3l6 6M9 3l-6 6"
              stroke={tokens.mute}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 16,
    gap: 18,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyText: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
  },
  section: {
    gap: 8,
  },
  eyebrowRow: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    fontWeight: "700",
    color: tokens.mute,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  eyebrowAccent: {
    color: tokens.orange,
  },
  eyebrowRule: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.border,
  },
  countPill: {
    backgroundColor: tokens.veryFaint,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countPillAccent: {
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  countLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    fontWeight: "700",
    color: tokens.mute,
    lineHeight: 12,
  },
  countLabelAccent: {
    color: tokens.orange,
  },
  sectionBody: {
    gap: 8,
  },
  actionRow: {
    backgroundColor: tokens.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  actionRowOrange: {
    borderColor: "rgba(255,90,54,0.4)",
    borderLeftWidth: 3,
    borderLeftColor: tokens.orange,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileSoft: {
    backgroundColor: tokens.inkTint,
  },
  iconTileOrange: {
    backgroundColor: "rgba(255,90,54,0.12)",
  },
  actionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.1,
  },
  overduePill: {
    backgroundColor: tokens.orange,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  overduePillText: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    fontWeight: "700",
    color: tokens.cream,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    lineHeight: 12,
  },
  actionMeta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  actionBtns: {
    flexDirection: "row",
    gap: 7,
  },
  checkBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tokens.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBtnPrimary: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  skipBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tokens.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardGroup: {
    backgroundColor: tokens.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: "hidden",
  },
  staticRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  staticRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  staticStateGlyph: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: tokens.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  staticTextCol: {
    flex: 1,
    minWidth: 0,
  },
  staticTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
  staticMeta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.3,
  },
  loggedStateGlyph: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  loggedStateGlyphDone: {
    backgroundColor: tokens.ink,
  },
  loggedStateGlyphMissed: {
    borderWidth: 1.5,
    borderColor: tokens.orange,
  },
  loggedStateGlyphSkip: {
    borderWidth: 1,
    borderColor: tokens.faint,
    borderStyle: "dashed",
  },
  loggedTextCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
  },
  loggedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
  loggedTitleSkip: {
    textDecorationLine: "line-through",
    color: tokens.mute,
  },
  loggedSlot: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.3,
  },
  loggedMeta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.3,
  },
  loggedMetaMissed: {
    color: tokens.orange,
    fontWeight: "700",
  },
  reopenBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: tokens.faint,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
