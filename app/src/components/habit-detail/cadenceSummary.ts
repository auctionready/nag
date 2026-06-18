import type { Regularity } from "@nag/schema";
import { AllDays } from "@nag/core";
import { formatTime, friendlyDaysLabel } from "../../components/formatters";

interface SummaryInput {
  regularity: Regularity | null;
  frequency: number | null;
  schedules: {
    days: number | null;
    hour?: number | null;
    minute?: number | null;
  }[];
}

/**
 * Lowercase mono caption shown under the habit title — combines
 * the cadence ("daily" / "3× / wk" / "weekly"), any time-of-day
 * schedule pills, and a friendly day-mask when one fits ("weekdays",
 * "weekends"). Returns `null` when there's no goal yet so the caller
 * can drop the line.
 */
export const cadenceSummary = ({
  regularity,
  frequency,
  schedules,
}: SummaryInput): string | null => {
  if (regularity == null || frequency == null) return null;

  // Distinct timed slots, in chronological order — keeps the caption stable
  // when the same time has multiple day-masks attached.
  const times = uniqueTimes(schedules);

  // A scheduled habit whose every slot fires on all seven days is a *daily*
  // habit, even though it's stored as a weekly goal with a popcount-derived
  // frequency (7 for one slot, 14 for two, …). Labelling it "7× / wk" reads
  // as weekly; collapse it to "daily" / "Nx / day" so the detail matches the
  // tile chip's `everyDayTimeLabel` treatment.
  const everyDay =
    schedules.length > 0 && schedules.every((s) => coversEveryDay(s.days));

  const parts: string[] = [];
  parts.push(
    everyDay
      ? cadenceLabel("day", Math.max(times.length, 1))
      : cadenceLabel(regularity, frequency),
  );

  if (times.length > 0) {
    parts.push(
      times.map(([h, m]) => formatTime(h, m).toLowerCase()).join(" · "),
    );
  }

  // Day mask only relevant when the user wrote one — we only show a
  // friendly summary, not arbitrary masks (those go in the schedule
  // pills above the slots row). Skip it for every-day schedules: "daily"
  // already says it, so appending "every day" would be redundant.
  if (!everyDay) {
    const orMask = schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);
    if (orMask !== 0) {
      const friendly = friendlyDaysLabel(orMask);
      if (friendly && friendly !== "no days") parts.push(friendly);
    }
  }

  return parts.join(" · ");
};

/**
 * Whether a schedule's day-mask fires on every day of the week. `AllDays`
 * (all seven bits) is the value the schedule editor writes; a null/zero mask
 * also means "every day" per `appliesOnDay`.
 */
const coversEveryDay = (days: number | null): boolean =>
  days == null || days === 0 || days === AllDays;

const uniqueTimes = (
  schedules: {
    hour?: number | null;
    minute?: number | null;
  }[],
): [number, number][] => {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const s of schedules) {
    if (s.hour == null || s.minute == null) continue;
    const key = `${s.hour}:${s.minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([s.hour, s.minute]);
  }
  out.sort(([h1, m1], [h2, m2]) => h1 - h2 || m1 - m2);
  return out;
};

const cadenceLabel = (regularity: Regularity, frequency: number): string => {
  if (frequency <= 1) {
    if (regularity === "day") return "daily";
    if (regularity === "week") return "weekly";
    return "monthly";
  }
  const word =
    regularity === "day" ? "day" : regularity === "week" ? "wk" : "mo";
  return `${frequency}× / ${word}`;
};
