import type { Regularity } from "@nag/schema";
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

  const parts: string[] = [];
  parts.push(cadenceLabel(regularity, frequency));

  // Distinct timed slots, in chronological order — keeps the caption stable
  // when the same time has multiple day-masks attached.
  const times = uniqueTimes(schedules);
  if (times.length > 0) {
    parts.push(
      times.map(([h, m]) => formatTime(h, m).toLowerCase()).join(" · "),
    );
  }

  // Day mask only relevant when the user wrote one — we only show a
  // friendly summary, not arbitrary masks (those go in the schedule
  // pills above the slots row).
  const orMask = schedules.reduce((mask, s) => mask | (s.days ?? 0), 0);
  if (orMask !== 0) {
    const friendly = friendlyDaysLabel(orMask);
    if (friendly && friendly !== "no days") parts.push(friendly);
  }

  return parts.join(" · ");
};

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
