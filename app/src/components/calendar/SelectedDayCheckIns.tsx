import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addDays, format, isAfter, isSameDay } from "date-fns";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";
import { HabitGlyph } from "../glyphs";
import { timeToken } from "../formatters";
import { use24HourClock } from "../../infrastructure/preferences";
import type {
  CalendarHabit,
  DayCheckInGroup,
  WeekRow,
} from "./useCalendarData";

interface SelectedDayCheckInsProps {
  /** Null when no day is selected (week view's empty / habit-only state). */
  day: Date | null;
  today: Date;
  weekStart: Date;
  groups: DayCheckInGroup[];
  /** When non-null and `day` is also set, panel renders the single-habit
   * day detail. When non-null but `day` is null, panel renders a week
   * summary for the habit. */
  filteredHabit: CalendarHabit | null;
  /** Week-view row for the filtered habit (states + per-day check-ins). */
  weekRowForFilter: WeekRow | null;
  onClearFilter: () => void;
}

/**
 * Routes the bottom panel between four states:
 *   - nothing selected → render nothing
 *   - habit only → week summary for that habit
 *   - day only → multi-habit day list
 *   - habit + day → single-habit slot detail for that day
 */
export const SelectedDayCheckIns = ({
  day,
  today,
  weekStart,
  groups,
  filteredHabit,
  weekRowForFilter,
  onClearFilter,
}: SelectedDayCheckInsProps) => {
  if (filteredHabit && day) {
    const group = groups.find((g) => g.habitId === filteredHabit.id) ?? {
      habitId: filteredHabit.id,
      title: filteredHabit.title,
      icon: filteredHabit.icon,
      checkIns: [],
    };
    return (
      <FilteredHabitDetail
        day={day}
        today={today}
        habit={filteredHabit}
        group={group}
        onClear={onClearFilter}
      />
    );
  }

  if (filteredHabit && weekRowForFilter) {
    return (
      <WeekHabitSummary
        habit={filteredHabit}
        weekStart={weekStart}
        today={today}
        row={weekRowForFilter}
        onClear={onClearFilter}
      />
    );
  }

  if (day) {
    return <DayCheckInsList day={day} today={today} groups={groups} />;
  }

  return null;
};

// ── Multi-habit list (default state) ───────────────────────────────

interface DayCheckInsListProps {
  day: Date;
  today: Date;
  groups: DayCheckInGroup[];
}

const DayCheckInsList = ({ day, today, groups }: DayCheckInsListProps) => {
  const totals = groups.reduce(
    (acc, g) => {
      for (const c of g.checkIns) {
        acc.total++;
        if (c.skipped) acc.skip++;
        else acc.done++;
      }
      return acc;
    },
    { total: 0, done: 0, skip: 0 },
  );
  return (
    <View style={styles.section}>
      <DayHeader day={day} today={today} totals={totals} />
      {groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No check-ins this day.</Text>
        </View>
      ) : (
        <View style={styles.cardsStack}>
          {groups.map((g) => (
            <CardRow key={g.habitId} group={g} />
          ))}
        </View>
      )}
    </View>
  );
};

const CardRow = ({ group }: { group: DayCheckInGroup }) => {
  const done = group.checkIns.filter((c) => !c.skipped).length;
  const skip = group.checkIns.length - done;
  const note = skip > 0 ? `${done} done · ${skip} skip` : `${done} done`;
  return (
    <View style={styles.card}>
      <HabitSwatch icon={group.icon} />
      <View style={styles.cardText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {group.title}
        </Text>
        <Text style={styles.cardNote}>{note}</Text>
      </View>
      <View style={styles.dotRow}>
        {group.checkIns.map((c) => (
          <SlotDot key={c.id} kind={c.skipped ? "skip" : "done"} />
        ))}
      </View>
    </View>
  );
};

// ── Filtered single-habit detail ───────────────────────────────────

interface FilteredHabitDetailProps {
  day: Date;
  today: Date;
  habit: CalendarHabit;
  group: DayCheckInGroup;
  onClear: () => void;
}

const FilteredHabitDetail = ({
  day,
  today,
  habit,
  group,
  onClear,
}: FilteredHabitDetailProps) => {
  const router = useRouter();
  const done = group.checkIns.filter((c) => !c.skipped).length;
  const skip = group.checkIns.length - done;
  const total = Math.max(habit.perDayTarget, group.checkIns.length);

  return (
    <View style={styles.section}>
      <DayHeader
        day={day}
        today={today}
        totals={{ total: group.checkIns.length, done, skip }}
        trailing={
          <Pressable
            onPress={onClear}
            style={styles.clearPill}
            accessibilityLabel="Clear habit filter"
          >
            <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
              <Path
                d="M2 2l5 5M7 2l-5 5"
                stroke={tokens.ink}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.clearPillText}>clear</Text>
          </Pressable>
        }
      />
      <View style={styles.filteredBody}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <HabitGlyph
              kind={habit.icon}
              size={18}
              style="line"
              color={tokens.cream}
            />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {habit.title}
            </Text>
            <Text style={styles.summaryMeta}>
              {habit.perDayTarget > 1
                ? `${habit.perDayTarget}× per day target`
                : "1 per day"}
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <Text style={styles.statBig}>
              {done}
              <Text style={styles.statBigMute}> / {Math.max(1, total)}</Text>
            </Text>
            <Text style={styles.statCaption}>this day</Text>
          </View>
        </View>

        <Text style={styles.slotsLabel}>check-ins</Text>
        <SlotPills
          checkIns={group.checkIns}
          emptyText="Nothing logged for this habit on this day."
        />

        <Pressable
          style={styles.deeplink}
          onPress={() =>
            router.push({
              pathname: "/habit/[id]",
              params: { id: habit.id },
            })
          }
        >
          <Text style={styles.deeplinkText}>Open {habit.title}</Text>
          <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
            <Path
              d="M1 1l4 4.5L1 10"
              stroke={tokens.mute}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
};

// ── Week-summary for a single habit ────────────────────────────────

interface WeekHabitSummaryProps {
  habit: CalendarHabit;
  weekStart: Date;
  today: Date;
  row: WeekRow;
  onClear: () => void;
}

const WeekHabitSummary = ({
  habit,
  weekStart,
  today,
  row,
  onClear,
}: WeekHabitSummaryProps) => {
  const router = useRouter();
  const totals = row.perDay.reduce(
    (acc, day) => {
      for (const c of day) {
        acc.total++;
        if (c.skipped) acc.skip++;
        else acc.done++;
      }
      return acc;
    },
    { total: 0, done: 0, skip: 0 },
  );
  const scheduledDays = row.states.filter(
    (s) => s !== "unscheduled" && s !== "future",
  ).length;
  const weekTotal = Math.max(scheduledDays * habit.perDayTarget, 1);

  return (
    <View style={styles.section}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderText}>this week</Text>
        <Pressable
          onPress={onClear}
          style={styles.clearPill}
          accessibilityLabel="Clear habit filter"
        >
          <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
            <Path
              d="M2 2l5 5M7 2l-5 5"
              stroke={tokens.ink}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.clearPillText}>clear</Text>
        </Pressable>
      </View>

      <View style={styles.filteredBody}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <HabitGlyph
              kind={habit.icon}
              size={18}
              style="line"
              color={tokens.cream}
            />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {habit.title}
            </Text>
            <Text style={styles.summaryMeta}>
              {habit.perDayTarget > 1
                ? `${habit.perDayTarget}× per day target`
                : "1 per day"}
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <Text style={styles.statBig}>
              {totals.done}
              <Text style={styles.statBigMute}> / {weekTotal}</Text>
            </Text>
            <Text style={styles.statCaption}>this week</Text>
          </View>
        </View>

        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          const dayCheckIns = row.perDay[i];
          const isToday = isSameDay(day, today);
          const isFuture = isAfter(day, today);
          const done = dayCheckIns.filter((c) => !c.skipped).length;
          const skip = dayCheckIns.length - done;
          return (
            <View key={i} style={styles.dayBlock}>
              <View style={styles.dayBlockHeader}>
                <Text
                  style={[
                    styles.dayBlockLabel,
                    isToday && styles.dayBlockLabelToday,
                  ]}
                >
                  {isToday
                    ? `today · ${format(day, "MMM d").toLowerCase()}`
                    : format(day, "EEE · MMM d").toLowerCase()}
                </Text>
                {dayCheckIns.length > 0 ? (
                  <Text style={styles.dayHeaderTotals}>
                    <Text style={styles.dayHeaderTotalsValue}>{done}</Text> done
                    {skip > 0 ? (
                      <>
                        {" "}
                        · <Text style={styles.dayHeaderTotalsSkip}>
                          {skip}
                        </Text>{" "}
                        skip
                      </>
                    ) : null}
                  </Text>
                ) : null}
              </View>
              {isFuture ? (
                <Text style={styles.dayBlockMuted}>—</Text>
              ) : (
                <SlotPills checkIns={dayCheckIns} emptyText="nothing logged" />
              )}
            </View>
          );
        })}

        <Pressable
          style={styles.deeplink}
          onPress={() =>
            router.push({
              pathname: "/habit/[id]",
              params: { id: habit.id },
            })
          }
        >
          <Text style={styles.deeplinkText}>Open {habit.title}</Text>
          <Svg width={6} height={11} viewBox="0 0 6 11" fill="none">
            <Path
              d="M1 1l4 4.5L1 10"
              stroke={tokens.mute}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
};

// ── Shared slot pills ──────────────────────────────────────────────

interface SlotPillsProps {
  checkIns: { id: string; timestamp: Date; skipped: boolean }[];
  emptyText: string;
}

const SlotPills = ({ checkIns, emptyText }: SlotPillsProps) => {
  const fmt = timeToken(use24HourClock());
  if (checkIns.length === 0) {
    return <Text style={styles.noSlotsText}>{emptyText}</Text>;
  }
  return (
    <View style={styles.slotPills}>
      {checkIns.map((c) => (
        <View
          key={c.id}
          style={[
            styles.slotPill,
            !c.skipped && styles.slotPillDone,
            c.skipped && styles.slotPillSkip,
          ]}
        >
          {c.skipped ? <SkipGlyph /> : <DoneGlyph />}
          <Text
            style={[
              styles.slotPillText,
              !c.skipped && styles.slotPillTextDone,
              c.skipped && styles.slotPillTextSkip,
            ]}
          >
            {format(c.timestamp, fmt)}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ── Pieces ─────────────────────────────────────────────────────────

interface DayHeaderProps {
  day: Date;
  today: Date;
  totals: { total: number; done: number; skip: number };
  trailing?: React.ReactNode;
}

const DayHeader = ({ day, today, totals, trailing }: DayHeaderProps) => {
  const isToday = isSameDay(day, today);
  const dateLabel = isToday
    ? `today · ${format(day, "MMM d").toLowerCase()}`
    : format(day, "EEE · MMM d").toLowerCase();
  return (
    <View style={styles.dayHeader}>
      <Text style={styles.dayHeaderText}>{dateLabel}</Text>
      {trailing ? (
        trailing
      ) : (
        <Text style={styles.dayHeaderTotals}>
          <Text style={styles.dayHeaderTotalsValue}>{totals.done}</Text> done
          {totals.skip > 0 ? (
            <>
              {" "}
              · <Text style={styles.dayHeaderTotalsSkip}>
                {totals.skip}
              </Text>{" "}
              skip
            </>
          ) : null}
          {totals.total > 0 ? <> of {totals.total}</> : null}
        </Text>
      )}
    </View>
  );
};

const HabitSwatch = ({ icon }: { icon: DayCheckInGroup["icon"] }) => (
  <View style={styles.swatch}>
    <HabitGlyph kind={icon} size={16} style="line" color={tokens.ink} />
  </View>
);

const SlotDot = ({ kind }: { kind: "done" | "skip" | "pending" }) => {
  if (kind === "done") {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Svg width={7} height={7} viewBox="0 0 7 7" fill="none">
          <Path
            d="M1.5 3.5L2.8 5L5.5 2"
            stroke={tokens.cream}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  if (kind === "skip") {
    return (
      <View style={[styles.dot, styles.dotSkip]}>
        <Svg width={6} height={6} viewBox="0 0 6 6" fill="none">
          <Path
            d="M1 5L5 1"
            stroke={tokens.mute}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
  return <View style={[styles.dot, styles.dotPending]} />;
};

const DoneGlyph = () => (
  <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
    <Path
      d="M2 5.2L4.2 7.4L8 3.2"
      stroke={tokens.cream}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SkipGlyph = () => (
  <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
    <Path
      d="M2.5 7.5L7.5 2.5"
      stroke={tokens.mute}
      strokeWidth={1.7}
      strokeLinecap="round"
    />
  </Svg>
);

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    paddingBottom: 8,
  },
  dayHeader: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  dayHeaderText: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  dayHeaderTotals: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
  dayHeaderTotalsValue: {
    color: tokens.ink,
    fontWeight: "600",
  },
  dayHeaderTotalsSkip: {
    color: tokens.orange,
    fontWeight: "600",
  },
  cardsStack: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardNote: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  rowTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.veryFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: {
    backgroundColor: tokens.ink,
  },
  dotSkip: {
    borderWidth: 1,
    borderColor: tokens.faint,
    borderStyle: "dashed",
  },
  dotPending: {
    borderWidth: 1,
    borderColor: tokens.faint,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyText: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
  },
  clearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  clearPillText: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.ink,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  filteredBody: {
    paddingHorizontal: 16,
    gap: 10,
  },
  dayBlock: {
    gap: 6,
    paddingVertical: 4,
  },
  dayBlockHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  dayBlockLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  dayBlockLabelToday: {
    color: tokens.orange,
    fontWeight: "700",
  },
  dayBlockMuted: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.faint,
    paddingHorizontal: 2,
  },
  summaryCard: {
    backgroundColor: tokens.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.15,
  },
  summaryMeta: {
    marginTop: 3,
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
  summaryStats: {
    alignItems: "flex-end",
    gap: 1,
  },
  statBig: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  statBigMute: {
    color: tokens.mute,
    fontSize: 12,
    fontWeight: "500",
  },
  statCaption: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  slotsLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  noSlotsText: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: tokens.mute,
    paddingHorizontal: 2,
  },
  slotPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  slotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  slotPillDone: {
    backgroundColor: tokens.ink,
    borderColor: tokens.ink,
  },
  slotPillSkip: {
    borderColor: tokens.faint,
  },
  slotPillText: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    fontWeight: "600",
    color: tokens.ink,
  },
  slotPillTextDone: {
    color: tokens.cream,
  },
  slotPillTextSkip: {
    color: tokens.mute,
    textDecorationLine: "line-through",
  },
  deeplink: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deeplinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: tokens.ink,
    letterSpacing: -0.05,
  },
});
