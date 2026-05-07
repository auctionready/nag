import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { addDays, format, startOfDay } from "date-fns";
import { schemas, type GetHabitComplianceResult } from "@nag/api-client";
import { getHabitCompliance } from "../../infrastructure/apiClient";
import { useStartOfToday } from "../../infrastructure/today";
import { complianceColors } from "../getComplianceColor";

type HabitComplianceHistory = schemas.HabitComplianceHistory;
type DailyCompliance = schemas.DailyCompliance;
type GoalEpoch = schemas.GoalEpoch;

const STRIP_DAYS = 30;
const CELL_SIZE = 16;
const CELL_GAP = 4;

interface ComplianceHistoryProps {
  /** The habit's externalId — backend keys compliance docs by it. */
  habitExternalId: string;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: HabitComplianceHistory }
  | { kind: "error" };

/**
 * "How am I doing" section of the habit detail screen. Shows the last
 * 30 days as a colour-coded strip (green/orange/red) using the
 * server-side <c>HabitComplianceHistory</c> projection.
 *
 * Signed-in + online: renders the strip.
 * Signed-out: shows a sign-in CTA (option (c)) — tapping navigates to
 * the account tab. Future tiers may unlock a calendar view (week /
 * month / year) gated on an in-app purchase.
 * Offline / fetch error: same CTA, with an "offline" hint, so the
 * layout is stable once the user signs in or reconnects.
 */
export const ComplianceHistory = ({
  habitExternalId,
}: ComplianceHistoryProps) => {
  const todayStart = useStartOfToday();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ kind: "idle" });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setState({ kind: "loading" });
    getHabitCompliance(habitExternalId).then(
      (result: GetHabitComplianceResult) => {
        if (cancelled) return;
        if (result.ok) {
          setState({ kind: "ok", data: result.response });
        } else {
          setState({ kind: "error" });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [habitExternalId, isLoaded, isSignedIn]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <SignInCta variant="default" onPress={() => router.push("/account")} />
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <Card label="How am I doing" body={<View style={styles.skeleton} />} />
    );
  }

  if (state.kind === "error") {
    return (
      <SignInCta variant="error" onPress={() => router.push("/account")} />
    );
  }

  return (
    <Card
      label="How am I doing"
      body={<ComplianceStrip history={state.data} now={todayStart} />}
    />
  );
};

interface ComplianceStripProps {
  history: HabitComplianceHistory;
  now: Date;
}

const ComplianceStrip = ({ history, now }: ComplianceStripProps) => {
  const days = fillDays(history, now, STRIP_DAYS);
  const summary = summarise(days);

  return (
    <View style={styles.stripContainer}>
      <View style={styles.row}>
        {days.map((d) => (
          <View
            key={d.date ?? ""}
            style={[styles.cell, { backgroundColor: cellColor(d) }]}
          />
        ))}
      </View>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
};

const SignInCta = ({
  variant,
  onPress,
}: {
  variant: "default" | "error";
  onPress: () => void;
}) => (
  <Pressable style={styles.cta} onPress={onPress}>
    <Text style={styles.label}>How am I doing</Text>
    <Text style={styles.ctaBody}>
      {variant === "error"
        ? "Sign in to see your history (offline right now)."
        : "Sign in to see your compliance history."}
    </Text>
  </Pressable>
);

const Card = ({ label, body }: { label: string; body: React.ReactNode }) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    {body}
  </View>
);

/**
 * Walks the last <paramref name="dayCount"/> days ending today, looking
 * each up in the server response and synthesising a placeholder for
 * dates the projection didn't emit. Dates with no entry mean either
 * "no goal active" (rendered blank) or "daily goal missed" (rendered
 * red) depending on what the goal timeline says was active that day.
 */
export const fillDays = (
  history: HabitComplianceHistory,
  now: Date,
  dayCount: number,
): DailyCompliance[] => {
  const byDate = new Map<string, DailyCompliance>();
  for (const d of history.days ?? []) {
    if (d.date) byDate.set(d.date, d);
  }
  const today = startOfDay(now);
  const start = addDays(today, -(dayCount - 1));
  const out: DailyCompliance[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);
    const key = format(date, "yyyy-MM-dd");
    const existing = byDate.get(key);
    if (existing) {
      out.push(existing);
      continue;
    }
    const goal = goalAt(history.goalTimeline ?? [], date);
    const target = targetForGoal(goal);
    out.push({
      date: key,
      done: 0,
      target,
      status: target > 0 ? "missed" : "noGoal",
    });
  }
  return out;
};

const goalAt = (timeline: GoalEpoch[], date: Date): GoalEpoch | null => {
  // Walk from the end to find the latest epoch whose effective time is
  // on or before the end of the day. Mirrors the server-side helper.
  const dayEnd = addDays(startOfDay(date), 1);
  for (let i = timeline.length - 1; i >= 0; i--) {
    const epoch = timeline[i];
    if (!epoch.effectiveFrom) continue;
    if (epoch.effectiveFrom <= dayEnd) return epoch;
  }
  return null;
};

const targetForGoal = (goal: GoalEpoch | null): number => {
  if (!goal || !goal.regularity) return 0;
  return goal.regularity === "day" ? (goal.frequency ?? 0) : 0;
};

const cellColor = (d: DailyCompliance): string => {
  switch (d.status) {
    case "onTrack":
      return complianceColors.compliant;
    case "partial":
      return complianceColors.partial;
    case "missed":
      return complianceColors.failing;
    case "logged":
      return complianceColors.compliant;
    case "noGoal":
    default:
      return "#eee";
  }
};

const summarise = (days: DailyCompliance[]): string => {
  let onPace = 0;
  let counted = 0;
  for (const d of days) {
    if (d.status === "noGoal") continue;
    counted++;
    if (d.status === "onTrack" || d.status === "logged") onPace++;
  }
  if (counted === 0) return "No goal history yet.";
  return `${onPace} / ${counted} days on goal`;
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stripContainer: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
  },
  summary: {
    fontSize: 13,
    color: "#666",
  },
  skeleton: {
    height: CELL_SIZE,
    backgroundColor: "#f2f2f4",
    borderRadius: 3,
  },
  cta: {
    gap: 6,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
  },
  ctaBody: {
    fontSize: 14,
    color: "#444",
  },
});
