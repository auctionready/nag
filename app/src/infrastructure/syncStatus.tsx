import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { devFlags } from "./devFlags";
import { AppState } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import * as Sentry from "@sentry/react-native";
import {
  createDispatcher,
  createPullSync,
  makeSingleflight,
  resumeDispatch,
  countPending,
  countFailed,
  getAccountId,
  isHalted,
  type DispatchStatus,
} from "@nag/core";
import { db } from "../db";
import { postCommitBus } from "./postCommitBus";
import {
  isApiConfigured,
  logApiConfig,
  postEvents,
  getSync,
} from "./apiClient";
import { log } from "./log";

const logger = log("sync");

export type SyncUiStatus =
  | "disabled"
  | "idle"
  | "syncing"
  | "offline"
  | "halted";

export type SyncStatusContextValue = {
  status: SyncUiStatus;
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
  resume: () => Promise<void>;
  /**
   * Imperative trigger for the sync loop. Use after non-event-driven
   * state changes (e.g. swapping the local account on second-device
   * sign-in) so the user sees data without waiting on the safety timer.
   * No-op when sync is disabled.
   */
  kickSync: (source: string) => void;
  /**
   * True when no `accountId` is persisted yet — i.e. the user has never
   * signed in on this install, or has just signed out via
   * `clearLocalAuth`. The dispatcher / pull-sync are deliberately not
   * running, so sync UI (dot, pill, panel) should hide rather than
   * misleadingly render an "offline" state.
   */
  isAnonymous: boolean;
};

const SAFETY_TIMER_MS = 60_000;

const SyncStatusContext = createContext<SyncStatusContextValue>({
  status: "disabled",
  pendingCount: 0,
  failedCount: 0,
  lastError: null,
  resume: async () => {},
  kickSync: () => {},
  // Default true so the sync indicators stay hidden during the brief
  // pre-mount window where the real state hasn't been resolved yet.
  isAnonymous: true,
});

export const useSyncStatus = () => useContext(SyncStatusContext);

export const SyncStatusProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<SyncUiStatus>("disabled");
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);

  // Keep a ref to the latest online state so the dispatcher can bail out
  // immediately if we go offline mid-run.
  const onlineRef = useRef<boolean>(true);

  // Set by `resume` (the user tapping Retry on the banner) to make the next
  // run bypass the offline guard below. A ref — not a kick parameter —
  // because singleflight may coalesce the kick into an in-flight run; the
  // flag survives until an `inner` invocation actually consumes it. The
  // dispatcher and pull-sync already report `offline` on network failures,
  // so forcing a run when supposedly offline is safe and gives the user
  // visible feedback ("syncing" → "offline") instead of silent no-op.
  const forceNextRunRef = useRef<boolean>(false);

  const refreshCounts = useCallback(async () => {
    try {
      const [accountId, p, f, h] = await Promise.all([
        getAccountId(db),
        countPending(db),
        countFailed(db),
        isHalted(db),
      ]);
      logger.debug(
        `counts pending=${p} failed=${f} halted=${h} anonymous=${!accountId}`,
      );
      setPendingCount(p);
      setFailedCount(f);
      setIsAnonymous(!accountId);
      if (h) {
        setStatus("halted");
      }
    } catch (e) {
      logger.error("refreshCounts failed", e);
      Sentry.captureException(e);
    }
  }, []);

  const enabled = useMemo(() => {
    logApiConfig();
    const e = isApiConfigured();
    logger.info(`provider init enabled=${e}`);
    return e;
  }, []);

  // Run-id counter so we can correlate kick → inner → complete across
  // overlapping calls and see singleflight coalescing at a glance.
  const runIdRef = useRef(0);
  const activeRunRef = useRef<number | null>(null);

  const runWithSingleflight = useMemo(() => {
    if (!enabled) return async () => {};
    const dispatcher = createDispatcher({
      db,
      post: postEvents,
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("dispatcher onError", message);
        setLastError(message);
        Sentry.captureException(err);
      },
      log: {
        debug: (m, ...a) => logger.debug(m, ...a),
        info: (m, ...a) => logger.info(m, ...a),
        error: (m, ...a) => logger.error(m, ...a),
      },
    });
    const pullSync = createPullSync({
      db,
      getSync,
      log: {
        debug: (m, ...a) => logger.debug(m, ...a),
        info: (m, ...a) => logger.info(m, ...a),
        error: (m, ...a) => logger.error(m, ...a),
      },
    });
    const inner = async () => {
      const runId = ++runIdRef.current;
      activeRunRef.current = runId;
      // Consume the force flag at run entry so a forced retry that's
      // coalesced into an in-flight run still hands the flag to the
      // follow-up rerun via singleflight's pendingRerun.
      const forced = forceNextRunRef.current;
      forceNextRunRef.current = false;
      logger.debug(`run[${runId}] enter forced=${forced}`);
      // Anonymous gate: no accountId means the user has never signed in
      // (or just signed out). Don't fire a sync run that would no-op
      // anyway and don't flash "syncing"/"offline" through the UI —
      // refreshCounts will mark this as anonymous so indicators hide.
      const accountId = await getAccountId(db);
      if (!accountId) {
        logger.debug(`run[${runId}] skipped — anonymous (no accountId)`);
        await refreshCounts();
        activeRunRef.current = null;
        return;
      }
      if (!forced && !onlineRef.current) {
        logger.debug(`run[${runId}] skipped — offline`);
        setStatus("offline");
        await refreshCounts();
        activeRunRef.current = null;
        return;
      }
      logger.debug(`run[${runId}] start`);
      setStatus("syncing");
      const started = Date.now();
      // Heartbeats at 10s and 30s so a stuck run announces itself instead
      // of looking indistinguishable from silence. The per-POST timeout
      // should rescue at 20s, but backlogged batches can legitimately run
      // longer; the 30s warning flags those too.
      const slowWarn10 = setTimeout(
        () => logger.warn(`run[${runId}] still running after 10s`),
        10_000,
      );
      const slowWarn30 = setTimeout(
        () =>
          logger.warn(
            `run[${runId}] still running after 30s — per-POST timeout should have fired; inspect earlier [nag][api] POST lines`,
          ),
        30_000,
      );
      try {
        const pushResult: DispatchStatus = await dispatcher.run();
        logger.info(
          `run[${runId}] push complete (${Date.now() - started}ms) result=${pushResult}`,
        );
        if (pushResult === "halted") {
          // A 4xx round-tripped: server is reachable, NetInfo can't be
          // claiming we're offline either.
          onlineRef.current = true;
          setStatus("halted");
        } else if (pushResult === "offline") {
          setStatus("offline");
        } else if (__DEV__ && devFlags.disablePullSync) {
          logger.warn(`run[${runId}] pull sync disabled (devFlags)`);
          // Push succeeded — server reachable.
          onlineRef.current = true;
          setStatus("idle");
        } else {
          // Push succeeded — try the pull side. Order matters: drain
          // first so a snapshot doesn't wipe a pending local command.
          // Push succeeding is itself proof of network reachability:
          // self-heal `onlineRef` so a stale NetInfo "offline" reading
          // doesn't keep blocking subsequent automatic kicks.
          onlineRef.current = true;
          const pullResult = await pullSync.run();
          logger.info(
            `run[${runId}] pull complete (${Date.now() - started}ms) result=${pullResult}`,
          );
          if (pullResult === "halted") setStatus("halted");
          else if (pullResult === "offline") setStatus("offline");
          else setStatus("idle");
        }
      } catch (e) {
        logger.error(`run[${runId}] threw (${Date.now() - started}ms)`, e);
        Sentry.captureException(e);
        setStatus("offline");
      } finally {
        clearTimeout(slowWarn10);
        clearTimeout(slowWarn30);
        await refreshCounts();
        activeRunRef.current = null;
      }
    };
    return makeSingleflight(inner);
  }, [enabled, refreshCounts]);

  const kick = useCallback(
    (source: string) => {
      if (!enabled) {
        logger.debug(`kick(${source}) ignored — disabled`);
        return;
      }
      const active = activeRunRef.current;
      if (active !== null) {
        logger.debug(`kick(${source}) coalesced into in-flight run[${active}]`);
      } else {
        logger.debug(`kick(${source}) → launching new run`);
      }
      void runWithSingleflight();
    },
    [enabled, runWithSingleflight],
  );

  // NetInfo subscription: kick when we come online; reflect offline state.
  useEffect(() => {
    if (!enabled) return;
    let unsubscribe = () => {};
    try {
      unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const online =
          state.isConnected === true && state.isInternetReachable !== false;
        logger.debug(
          `netinfo event isConnected=${state.isConnected} isInternetReachable=${state.isInternetReachable} → online=${online}`,
        );
        const wasOffline = !onlineRef.current;
        onlineRef.current = online;
        if (online && wasOffline) {
          kick("netinfo-online");
        } else if (!online) {
          setStatus("offline");
        }
      });
    } catch (e) {
      logger.error("NetInfo.addEventListener failed", e);
    }
    // Also fetch the initial state so we don't wait for the first change.
    NetInfo.fetch()
      .then((state) => {
        const online =
          state.isConnected === true && state.isInternetReachable !== false;
        logger.debug(
          `netinfo initial isConnected=${state.isConnected} isInternetReachable=${state.isInternetReachable} → online=${online}`,
        );
        onlineRef.current = online;
        if (online) kick("netinfo-initial");
        else setStatus("offline");
      })
      .catch((e) => {
        logger.error("NetInfo.fetch failed — assuming online", e);
        onlineRef.current = true;
        kick("netinfo-fallback");
      });
    return unsubscribe;
  }, [enabled, kick]);

  // AppState subscription: kick on transition to active.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      logger.debug(`appstate change → ${state}`);
      if (state === "active") kick("appstate-active");
    });
    return () => sub.remove();
  }, [enabled, kick]);

  // Post-commit subscription.
  useEffect(() => {
    if (!enabled) return;
    return postCommitBus.subscribe(() => kick("post-commit"));
  }, [enabled, kick]);

  // Periodic safety-net timer while foregrounded.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") kick("safety-timer");
    }, SAFETY_TIMER_MS);
    return () => clearInterval(timer);
  }, [enabled, kick]);

  // Initial counts load (covers the case where we're online from the start
  // and the dispatcher runs once via NetInfo.fetch above).
  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  // Public kickSync: every external caller fires this *after* a successful
  // network round-trip (post-upgrade, post-pair, post-force-upgrade,
  // post-signout) — i.e. the device is provably online at the moment of
  // the call. So we (a) heal `onlineRef` (NetInfo may be reporting stale
  // or wrong state — Android over VPN/captive, post-foreground races) and
  // (b) force past the offline guard so the kick can't be silently
  // skipped. Without this, post-upgrade kicks were getting swallowed by
  // a stale `onlineRef = false`, leaving the user staring at an "offline"
  // banner immediately after a successful sign-in.
  const kickSync = useCallback(
    (source: string) => {
      onlineRef.current = true;
      forceNextRunRef.current = true;
      kick(source);
    },
    [kick],
  );

  const resume = useCallback(async () => {
    logger.info("resume requested");
    try {
      await resumeDispatch(db);
      setLastError(null);
      await refreshCounts();
      // Manual Retry: the user has explicitly asked us to try again.
      // Route through `kickSync` so we force past the offline guard and
      // give the dispatcher a real chance to prove the network state —
      // the user sees "syncing" → either "idle" or "offline" instead of
      // a silent no-op when NetInfo's cached state is stale.
      kickSync("resume");
    } catch (e) {
      logger.error("resume failed", e);
      Sentry.captureException(e);
    }
  }, [kickSync, refreshCounts]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      status: enabled ? status : "disabled",
      pendingCount,
      failedCount,
      lastError,
      resume,
      kickSync,
      isAnonymous,
    }),
    [
      enabled,
      status,
      pendingCount,
      failedCount,
      lastError,
      resume,
      kickSync,
      isAnonymous,
    ],
  );

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
};
