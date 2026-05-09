import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { schemas, type GetHabitComplianceResult } from "@nag/api-client";
import { getHabitCompliance } from "../../infrastructure/apiClient";
import { useStartOfToday } from "../../infrastructure/today";
import { tokens } from "../../components/theme";

type HabitComplianceHistory = schemas.HabitComplianceHistory;
type DailyCompliance = schemas.DailyCompliance;

interface HowAmIDoingCardProps {
  habitExternalId: string;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: HabitComplianceHistory }
  | { kind: "error" };

const HEATMAP_WEEKS = 12;
const ROLLING_DAYS = 30;

/**
 * Provisional "how am I doing" panel — 30-day rolling completion %, a
 * sparkline of the same window, and a 12-week heatmap. Heatmap cells
 * use the same `done · partial · missed · skip` vocabulary as the
 * home tile and detail week-strip so the longer view rhymes.
 */
export const HowAmIDoingCard = ({ habitExternalId }: HowAmIDoingCardProps) => {
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
      <Card>
        <View style={styles.skeleton} />
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <SignInCta variant="error" onPress={() => router.push("/account")} />
    );
  }

  return (
    <Card>
      <Body data={state.data} now={todayStart} />
    </Card>
  );
};

const Body = ({ data, now }: { data: HabitComplianceHistory; now: Date }) => {
  const recent = recentSummary(data, now, ROLLING_DAYS);
  const sparkPoints = sparklinePoints(data, now, ROLLING_DAYS);
  const heatmap = buildHeatmap(data, now, HEATMAP_WEEKS);

  return (
    <View style={styles.body}>
      <View style={styles.statRow}>
        <View style={styles.statText}>
          <Text style={styles.statEyebrow}>30-day completion</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{recent.pct}</Text>
            <Text style={styles.statUnit}>%</Text>
            {recent.delta !== null && (
              <Text
                style={[
                  styles.statDelta,
                  recent.delta >= 0 ? styles.deltaUp : styles.deltaDown,
                ]}
              >
                {recent.delta >= 0 ? "↑" : "↓"} {Math.abs(recent.delta)} vs
                prior
              </Text>
            )}
          </View>
        </View>
        <Sparkline points={sparkPoints} />
      </View>

      <View style={styles.heatmapWrap}>
        <View style={styles.heatmapAxisRow}>
          <Text style={styles.heatmapAxis}>{HEATMAP_WEEKS} weeks ago</Text>
          <Text style={styles.heatmapAxis}>now</Text>
        </View>
        <View style={styles.heatmapGrid}>
          {Array.from({ length: HEATMAP_WEEKS }, (_, w) => (
            <View key={w} style={styles.heatmapCol}>
              {Array.from({ length: 7 }, (_, d) => (
                <HeatCell key={d} state={heatmap[w]?.[d] ?? "skip"} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

type HeatState = "done" | "partial" | "missed" | "skip";

const HeatCell = ({ state }: { state: HeatState }) => {
  if (state === "done")
    return <View style={[styles.heatCell, styles.heatDone]} />;
  if (state === "skip")
    return <View style={[styles.heatCell, styles.heatSkip]} />;
  if (state === "partial") {
    return (
      <View style={[styles.heatCell, styles.heatRing]}>
        <View style={styles.heatPartialFill} />
      </View>
    );
  }
  return <View style={[styles.heatCell, styles.heatRing]} />;
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardEyebrow}>how am i doing</Text>
      <Text style={styles.cardSub}>last 12 weeks · provisional</Text>
    </View>
    {children}
  </View>
);

const SignInCta = ({
  variant,
  onPress,
}: {
  variant: "default" | "error";
  onPress: () => void;
}) => (
  <Pressable style={styles.cta} onPress={onPress}>
    <Text style={styles.cardEyebrow}>how am i doing</Text>
    <Text style={styles.ctaBody}>
      {variant === "error"
        ? "Sign in to see your history (offline right now)."
        : "Sign in to see your compliance history."}
    </Text>
  </Pressable>
);

// ── Data shaping helpers ──────────────────────────────────────────────

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const indexByDate = (
  data: HabitComplianceHistory,
): Map<string, DailyCompliance> => {
  const map = new Map<string, DailyCompliance>();
  for (const d of data.days ?? []) {
    if (d.date) map.set(d.date, d);
  }
  return map;
};

// "Done": the day was fully on goal. "Partial": logged but not enough.
// "Missed": expected something, got nothing. "Skip": no goal that day.
const stateOf = (d: DailyCompliance | undefined): HeatState => {
  if (!d) return "skip";
  switch (d.status) {
    case "onTrack":
    case "logged":
      return "done";
    case "partial":
      return "partial";
    case "missed":
      return "missed";
    case "noGoal":
    default:
      return "skip";
  }
};

const buildHeatmap = (
  data: HabitComplianceHistory,
  now: Date,
  weekCount: number,
): HeatState[][] => {
  const idx = indexByDate(data);
  const today = startOfDay(now);
  // Anchor the rightmost column on the *current week's Monday* so days
  // line up Mon..Sun the same as the rest of the app's week strips.
  const lastMonday = startOfWeek(today, { weekStartsOn: 1 });
  const out: HeatState[][] = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const weekStart = addDays(lastMonday, -w * 7);
    const week: HeatState[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      // Future days within the current week — paint as skip so they
      // read as "not yet" instead of "missed".
      if (date > today) week.push("skip");
      else week.push(stateOf(idx.get(dayKey(date))));
    }
    out.push(week);
  }
  return out;
};

const recentSummary = (
  data: HabitComplianceHistory,
  now: Date,
  windowDays: number,
): { pct: number; delta: number | null } => {
  const idx = indexByDate(data);
  const today = startOfDay(now);
  // Current window = last `windowDays` ending today; prior window =
  // the same length immediately before that. % is "good days / counted
  // days", excluding noGoal so a week of dormancy doesn't tank the
  // headline.
  const score = (start: Date, end: Date) => {
    let onPace = 0;
    let counted = 0;
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
      const entry = idx.get(dayKey(day));
      const state = stateOf(entry);
      if (state === "skip") continue;
      counted++;
      if (state === "done") onPace++;
    }
    return {
      pct: counted > 0 ? Math.round((onPace * 100) / counted) : 0,
      counted,
    };
  };

  const currentEnd = today;
  const currentStart = addDays(today, -(windowDays - 1));
  const priorEnd = addDays(currentStart, -1);
  const priorStart = addDays(priorEnd, -(windowDays - 1));

  const current = score(currentStart, currentEnd);
  const prior = score(priorStart, priorEnd);
  return {
    pct: current.pct,
    delta: prior.counted > 0 ? current.pct - prior.pct : null,
  };
};

const sparklinePoints = (
  data: HabitComplianceHistory,
  now: Date,
  windowDays: number,
): number[] => {
  const idx = indexByDate(data);
  const today = startOfDay(now);
  // 7 sample buckets across the window — coarse enough to read at
  // sparkline scale, smooth enough that a single bad week doesn't
  // crater the line.
  const buckets = 7;
  const bucketSize = Math.max(1, Math.floor(windowDays / buckets));
  const points: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const end = addDays(today, -((buckets - 1 - i) * bucketSize));
    const start = addDays(end, -(bucketSize - 1));
    let onPace = 0;
    let counted = 0;
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
      const state = stateOf(idx.get(dayKey(day)));
      if (state === "skip") continue;
      counted++;
      if (state === "done") onPace++;
    }
    points.push(counted > 0 ? onPace / counted : 0);
  }
  return points;
};

const Sparkline = ({ points }: { points: number[] }) => {
  const W = 80;
  const H = 30;
  const max = Math.max(...points, 0.0001);
  const step = W / Math.max(1, points.length - 1);
  const path = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - (p / max) * (H - 4) - 2).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const lastX = (points.length - 1) * step;
  const lastY = H - (points[points.length - 1] / max) * (H - 4) - 2;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path
        d={path}
        fill="none"
        stroke={tokens.ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={lastX} cy={lastY} r={2} fill={tokens.orange} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  cardSub: {
    fontFamily: "JetBrainsMono",
    fontSize: 9.5,
    color: tokens.mute,
    letterSpacing: 0.4,
  },
  body: {
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: tokens.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.veryFaint,
  },
  statText: {
    flex: 1,
    gap: 2,
  },
  statEyebrow: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "500",
    color: tokens.mute,
  },
  statDelta: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 6,
    letterSpacing: 0.4,
  },
  deltaUp: { color: "#3CC07A" },
  deltaDown: { color: tokens.orange },
  heatmapWrap: {
    gap: 6,
  },
  heatmapAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  heatmapAxis: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 0.6,
  },
  heatmapGrid: {
    flexDirection: "row",
    gap: 3,
  },
  heatmapCol: {
    flex: 1,
    gap: 3,
  },
  heatCell: {
    aspectRatio: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  heatDone: {
    backgroundColor: tokens.ink,
  },
  heatSkip: {
    backgroundColor: tokens.veryFaint,
  },
  heatRing: {
    borderWidth: 1,
    borderColor: tokens.faint,
    backgroundColor: "transparent",
    position: "relative",
  },
  heatPartialFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
    backgroundColor: tokens.ink,
  },
  cta: {
    marginHorizontal: 14,
    backgroundColor: tokens.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    gap: 6,
  },
  ctaBody: {
    fontSize: 14,
    color: tokens.inkSoft,
  },
  skeleton: {
    height: 80,
    backgroundColor: tokens.veryFaint,
    borderRadius: 8,
  },
});
