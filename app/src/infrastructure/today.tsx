import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { startOfDay } from "date-fns";

const TodayContext = createContext<Date | null>(null);

const computeStartOfToday = (): Date => startOfDay(new Date());

const msUntilNextMidnight = (now: Date): number => {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  // 1s buffer so the timer is provably past the boundary before we
  // recompute startOfDay (some platforms fire setTimeout a few ms early).
  return next.getTime() - now.getTime() + 1000;
};

/**
 * App-wide source of today's `startOfDay` Date. Updates exactly when the
 * calendar day rolls over — via a midnight timer while the app is
 * foregrounded, or via the AppState `"active"` transition when the app
 * is brought back from the background. Components consume the value
 * through `useStartOfToday()`.
 *
 * `startOfDay` (not raw `new Date()`) is deliberate: every consumer
 * gets a value with reference-stable identity across the calendar day,
 * so memo / `useLiveQuery` deps keyed off it don't churn between
 * consumer renders.
 */
export const TodayProvider = ({ children }: PropsWithChildren) => {
  const [today, setToday] = useState<Date>(computeStartOfToday);

  useEffect(() => {
    const refresh = () => {
      // Functional update so we can compare against the latest committed
      // value without reading a ref during render. No-op when the day
      // hasn't changed — a setState here would re-render every consumer
      // for nothing.
      setToday((curr) => {
        const next = computeStartOfToday();
        return next.getTime() !== curr.getTime() ? next : curr;
      });
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      timer = setTimeout(() => {
        refresh();
        arm();
      }, msUntilNextMidnight(new Date()));
    };
    arm();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      refresh();
      // Re-arm so the next tick is relative to the (possibly new)
      // current day, not whatever yesterday's timer was scheduled for.
      if (timer) clearTimeout(timer);
      arm();
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return (
    <TodayContext.Provider value={today}>{children}</TodayContext.Provider>
  );
};

/**
 * Today's `startOfDay` Date. Reference-stable across the calendar day
 * (so it's safe in `useMemo` / `useLiveQuery` dep arrays); changes
 * exactly when the calendar day rolls over.
 */
export const useStartOfToday = (): Date => {
  const value = useContext(TodayContext);
  if (value === null) {
    throw new Error("useStartOfToday must be used within a TodayProvider");
  }
  return value;
};

const MS_PER_MINUTE = 60_000;

/**
 * Current Unix-epoch minute (`Math.floor(Date.now() / 60_000)`),
 * subscribing the consumer to calendar-day rollover for free. The
 * number is stable across renders within the same minute, so it's
 * safe in `useMemo` / `useEffect` dep arrays — perfect for
 * memoizing computations that key off "now" but only need
 * minute-granularity precision (time-slot status, picker bounds, etc.).
 *
 * Pair with `epochMinuteToDate` at the point of use.
 */
export const useCurrentEpochMinute = (): number => {
  const startOfToday = useStartOfToday();
  // Snapshot Date.now() outside render: lazy init covers first paint, the
  // effect re-snapshots on day rollover so consumers see a fresh minute
  // for the new day (within-minute precision is intentionally loose —
  // consumers re-key off `startOfToday`, not the minute itself).
  const [minute, setMinute] = useState(() =>
    Math.floor(Date.now() / MS_PER_MINUTE),
  );
  useEffect(() => {
    // Fires only on calendar-day rollover (rare), and the new value depends
    // on the external clock so it can't be derived in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinute(Math.floor(Date.now() / MS_PER_MINUTE));
  }, [startOfToday]);
  return minute;
};

/** Inverse of `useCurrentEpochMinute`: epoch-minute → start-of-minute Date. */
export const epochMinuteToDate = (epochMinute: number): Date =>
  new Date(epochMinute * MS_PER_MINUTE);
