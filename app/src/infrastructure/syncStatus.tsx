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

// Every interesting decision in the sync state machine emits a Sentry
// breadcrumb so an `offline` banner that turns out to be wrong can be
// reconstructed end-to-end. Material state transitions and the banner
// itself also emit `captureMessage`s so they're searchable as events
// (e.g. `nag.sync.offline-guard-skipped`, `nag.sync.banner-shown`).
const breadcrumb = (message: string, data?: Record<string, unknown>): void => {
  Sentry.addBreadcrumb({
    category: "nag.sync",
    type: "info",
    level: "info",
    message,
    data,
  });
};

const report = (
  message: string,
  level: "info" | "warning" | "error" = "info",
  data?: Record<string, unknown>,
): void => {
  Sentry.addBreadcrumb({
    category: "nag.sync",
    type: "info",
    level,
    message,
    data,
  });
  Sentry.captureMessage(message, {
    level,
    contexts: data ? { sync: data } : undefined,
    tags: { area: "sync" },
  });
};

export type SyncUiStatus =
  | "disabled"
  | "idle"
  | "syncing"
  | "offline"
  | "halted";

export type DrainOutboxStatus = DispatchStatus | "anonymous" | "disabled";

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
   * Awaitable push-only flush of the outbox. Returns when every pending
   * envelope has either reached the server (`"idle"`), the queue halts
   * on a non-retriable failure (`"halted"`), or the network gives up
   * (`"offline"`). Used by sign-in flows that need the local data to be
   * canonical on the server *before* the user moves on (e.g. the
   * "Use this device's data" force-upgrade, where switching to a second
   * device immediately afterwards would otherwise show an empty board
   * because the events never finished uploading). Unlike `kickSync`,
   * this drains the queue across as many batches as needed instead of
   * stopping after the dispatcher's batch limit.
   */
  drainOutbox: () => Promise<DrainOutboxStatus>;
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
  drainOutbox: async () => "disabled",
  // Default true so the sync indicators stay hidden during the brief
  // pre-mount window where the real state hasn't been resolved yet.
  isAnonymous: true,
});

export const useSyncStatus = () => useContext(SyncStatusContext);

export const SyncStatusProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatusRaw] = useState<SyncUiStatus>("disabled");
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

  // Mirrors the latest `status` so the `setStatus` wrapper can compute
  // `from → to` without depending on a render cycle. React's setter is
  // batched/lazy, but breadcrumbs need the snapshot at call time.
  const statusRef = useRef<SyncUiStatus>("disabled");

  // Wrapped setStatus — every transition is breadcrumbed, and any
  // transition INTO "offline" or "halted" is captured as a real Sentry
  // event so we can find them in search. `origin` lets us trace which
  // branch of the state machine fired the transition.
  const setStatus = useCallback((next: SyncUiStatus, origin: string): void => {
    const prev = statusRef.current;
    if (prev === next) {
      breadcrumb(`status no-op (${next})`, { origin });
      return;
    }
    statusRef.current = next;
    const data = {
      from: prev,
      to: next,
      origin,
      onlineRef: onlineRef.current,
      forceNextRunRef: forceNextRunRef.current,
    };
    if (next === "offline" || next === "halted") {
      report(`nag.sync.status: ${prev} → ${next}`, "warning", data);
    } else {
      breadcrumb(`status ${prev} → ${next}`, data);
    }
    setStatusRaw(next);
  }, []);

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
      breadcrumb("refreshCounts", {
        pending: p,
        failed: f,
        halted: h,
        anonymous: !accountId,
        accountId: accountId ?? null,
      });
      setPendingCount(p);
      setFailedCount(f);
      setIsAnonymous(!accountId);
      if (h) {
        setStatus("halted", "refreshCounts:isHalted");
      }
    } catch (e) {
      logger.error("refreshCounts failed", e);
      Sentry.captureException(e);
    }
  }, [setStatus]);

  const enabled = useMemo(() => {
    logApiConfig();
    const e = isApiConfigured();
    logger.info(`provider init enabled=${e}`);
    report(`nag.sync.provider init enabled=${e}`, "info", { enabled: e });
    return e;
  }, []);

  // Run-id counter so we can correlate kick → inner → complete across
  // overlapping calls and see singleflight coalescing at a glance.
  const runIdRef = useRef(0);
  const activeRunRef = useRef<number | null>(null);

  // Single dispatcher / pullSync instance per provider mount. Pulled out
  // of the `runWithSingleflight` closure so `drainOutbox` can reuse the
  // same dispatcher (its post/onError wiring) without rebuilding it.
  const dispatcher = useMemo(() => {
    if (!enabled) return null;
    return createDispatcher({
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
  }, [enabled]);

  const pullSync = useMemo(() => {
    if (!enabled) return null;
    return createPullSync({
      db,
      getSync,
      log: {
        debug: (m, ...a) => logger.debug(m, ...a),
        info: (m, ...a) => logger.info(m, ...a),
        error: (m, ...a) => logger.error(m, ...a),
      },
    });
  }, [enabled]);

  const runWithSingleflight = useMemo(() => {
    if (!enabled || !dispatcher || !pullSync) return async () => {};
    const inner = async () => {
      const runId = ++runIdRef.current;
      activeRunRef.current = runId;
      // Consume the force flag at run entry so a forced retry that's
      // coalesced into an in-flight run still hands the flag to the
      // follow-up rerun via singleflight's pendingRerun.
      const forced = forceNextRunRef.current;
      forceNextRunRef.current = false;
      logger.debug(`run[${runId}] enter forced=${forced}`);
      breadcrumb(`run[${runId}] enter`, {
        forced,
        onlineRef: onlineRef.current,
        statusBefore: statusRef.current,
      });
      // Anonymous gate: no accountId means the user has never signed in
      // (or just signed out). Don't fire a sync run that would no-op
      // anyway and don't flash "syncing"/"offline" through the UI —
      // refreshCounts will mark this as anonymous so indicators hide.
      const accountId = await getAccountId(db);
      if (!accountId) {
        logger.debug(`run[${runId}] skipped — anonymous (no accountId)`);
        breadcrumb(`run[${runId}] skipped — anonymous`);
        await refreshCounts();
        activeRunRef.current = null;
        return;
      }
      // Clear `isAnonymous` eagerly so the SyncDot/banner show "syncing"
      // during the initial post-sign-in drain. `refreshCounts` runs only
      // in the `finally` block, so without this the indicators stayed
      // hidden for the full drain — looking like the user wasn't signed
      // in.
      setIsAnonymous(false);
      if (!forced && !onlineRef.current) {
        logger.debug(`run[${runId}] skipped — offline`);
        report(`nag.sync.run skipped — offline guard`, "warning", {
          runId,
          forced,
          onlineRef: onlineRef.current,
          accountId,
        });
        setStatus("offline", `inner:offline-guard:run[${runId}]`);
        await refreshCounts();
        activeRunRef.current = null;
        return;
      }
      logger.debug(`run[${runId}] start`);
      breadcrumb(`run[${runId}] start`, { accountId });
      setStatus("syncing", `inner:start:run[${runId}]`);
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
        breadcrumb(`run[${runId}] push complete`, {
          pushResult,
          elapsedMs: Date.now() - started,
        });
        if (pushResult === "halted") {
          // A 4xx round-tripped: server is reachable, NetInfo can't be
          // claiming we're offline either.
          onlineRef.current = true;
          setStatus("halted", `inner:push-halted:run[${runId}]`);
        } else if (pushResult === "offline") {
          setStatus("offline", `inner:push-offline:run[${runId}]`);
        } else if (__DEV__ && devFlags.disablePullSync) {
          logger.warn(`run[${runId}] pull sync disabled (devFlags)`);
          // Push succeeded — server reachable.
          onlineRef.current = true;
          setStatus("idle", `inner:push-idle:run[${runId}]`);
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
          breadcrumb(`run[${runId}] pull complete`, {
            pullResult,
            elapsedMs: Date.now() - started,
          });
          if (pullResult === "halted")
            setStatus("halted", `inner:pull-halted:run[${runId}]`);
          else if (pullResult === "offline")
            setStatus("offline", `inner:pull-offline:run[${runId}]`);
          else setStatus("idle", `inner:pull-idle:run[${runId}]`);
        }
      } catch (e) {
        logger.error(`run[${runId}] threw (${Date.now() - started}ms)`, e);
        Sentry.captureException(e, {
          tags: { area: "sync", runId: String(runId) },
        });
        setStatus("offline", `inner:catch:run[${runId}]`);
      } finally {
        clearTimeout(slowWarn10);
        clearTimeout(slowWarn30);
        await refreshCounts();
        activeRunRef.current = null;
      }
    };
    return makeSingleflight(inner);
  }, [enabled, dispatcher, pullSync, refreshCounts, setStatus]);

  const kick = useCallback(
    (source: string) => {
      if (!enabled) {
        logger.debug(`kick(${source}) ignored — disabled`);
        breadcrumb(`kick ignored — disabled`, { source });
        return;
      }
      const active = activeRunRef.current;
      if (active !== null) {
        logger.debug(`kick(${source}) coalesced into in-flight run[${active}]`);
        breadcrumb(`kick coalesced`, {
          source,
          activeRunId: active,
          onlineRef: onlineRef.current,
          forceNextRunRef: forceNextRunRef.current,
          status: statusRef.current,
        });
      } else {
        logger.debug(`kick(${source}) → launching new run`);
        breadcrumb(`kick launching`, {
          source,
          onlineRef: onlineRef.current,
          forceNextRunRef: forceNextRunRef.current,
          status: statusRef.current,
        });
      }
      void runWithSingleflight();
    },
    [enabled, runWithSingleflight],
  );

  // Awaitable drain — loops `dispatcher.run()` until it reports `idle`,
  // `halted`, or `offline`, so a caller that needs every queued event
  // delivered (e.g. force-upgrade on the origin device, before the user
  // signs in on a second device and pulls an empty snapshot) can wait
  // for the queue to actually empty rather than the first batch to ship.
  // Bypasses the singleflight wrapper on purpose: the wrapper would
  // either hand back a stale in-flight promise that doesn't reflect the
  // post-upgrade state, or run pull-sync afterwards (which we don't
  // need) and pad the user's wait. Concurrent dispatcher.run calls are
  // safe — POST /events is idempotent on envelopeId and `markSent`
  // updates `highestServerSequence` via `MAX(...)`.
  const drainOutbox = useCallback(async (): Promise<DrainOutboxStatus> => {
    if (!enabled || !dispatcher) {
      logger.debug("drainOutbox: disabled");
      return "disabled";
    }
    const accountId = await getAccountId(db);
    if (!accountId) {
      logger.debug("drainOutbox: anonymous (no accountId)");
      return "anonymous";
    }
    if (!onlineRef.current) {
      logger.debug("drainOutbox: offline");
      return "offline";
    }
    setStatus("syncing", "drainOutbox:start");
    const started = Date.now();
    try {
      // Loop until the dispatcher returns a terminal status. `idle`
      // means the batch came back empty so the queue is fully drained;
      // `halted` and `offline` are sticky and need user action.
      // Cap the loop so a buggy server that keeps acking 200 without
      // advancing pending rows can't spin forever.
      const MAX_BATCHES = 50;
      let result: DispatchStatus = "idle";
      for (let i = 0; i < MAX_BATCHES; i++) {
        result = await dispatcher.run();
        if (result !== "idle") break;
        const remaining = await countPending(db);
        if (remaining === 0) break;
        logger.debug(
          `drainOutbox: batch ${i + 1} idle but ${remaining} pending — looping`,
        );
      }
      logger.info(`drainOutbox: result=${result} (${Date.now() - started}ms)`);
      if (result === "halted") setStatus("halted", "drainOutbox:halted");
      else if (result === "offline")
        setStatus("offline", "drainOutbox:offline");
      else setStatus("idle", "drainOutbox:idle");
      return result;
    } catch (e) {
      logger.error(`drainOutbox threw (${Date.now() - started}ms)`, e);
      Sentry.captureException(e, { tags: { area: "sync" } });
      setStatus("offline", "drainOutbox:catch");
      return "offline";
    } finally {
      await refreshCounts();
    }
  }, [enabled, dispatcher, refreshCounts, setStatus]);

  // NetInfo subscription: track `onlineRef` and kick when we transition
  // back to online. Deliberately does NOT call `setStatus("offline")` —
  // NetInfo on Android (VPN, captive networks, post-foreground races)
  // can report `isInternetReachable: false` even when the device is
  // online, and a direct setStatus would surface a false-offline banner.
  // The visible status is instead driven by actual sync attempts: the
  // `inner` offline guard sets it on a real automatic skip, and the
  // dispatcher/pull-sync set it from real push/pull results. If we're
  // truly offline, the next post-commit / safety-timer / AppState kick
  // will reflect it within seconds. If NetInfo lied, we stay on the
  // last truthful status instead of misleading the user.
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
        const onlineRefBefore = onlineRef.current;
        onlineRef.current = online;
        const data = {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          online,
          onlineRefBefore,
          wasOffline,
          status: statusRef.current,
        };
        if (onlineRefBefore !== online) {
          report(
            `nag.sync.netinfo-event onlineRef ${onlineRefBefore} → ${online}`,
            online ? "info" : "warning",
            data,
          );
        } else {
          breadcrumb(`netinfo-event (no change, online=${online})`, data);
        }
        if (online && wasOffline) {
          kick("netinfo-online");
        }
      });
    } catch (e) {
      logger.error("NetInfo.addEventListener failed", e);
      Sentry.captureException(e, { tags: { area: "sync" } });
    }
    // Also fetch the initial state so we don't wait for the first change.
    NetInfo.fetch()
      .then((state) => {
        const online =
          state.isConnected === true && state.isInternetReachable !== false;
        logger.debug(
          `netinfo initial isConnected=${state.isConnected} isInternetReachable=${state.isInternetReachable} → online=${online}`,
        );
        report(`nag.sync.netinfo-initial online=${online}`, "info", {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          online,
        });
        onlineRef.current = online;
        if (online) kick("netinfo-initial");
      })
      .catch((e) => {
        logger.error("NetInfo.fetch failed — assuming online", e);
        Sentry.captureException(e, { tags: { area: "sync" } });
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
      breadcrumb(`appstate change`, {
        state,
        status: statusRef.current,
        onlineRef: onlineRef.current,
      });
      if (state === "active") kick("appstate-active");
    });
    return () => sub.remove();
  }, [enabled, kick]);

  // Post-commit subscription.
  useEffect(() => {
    if (!enabled) return;
    return postCommitBus.subscribe(() => {
      breadcrumb(`post-commit`, {
        status: statusRef.current,
        onlineRef: onlineRef.current,
      });
      kick("post-commit");
    });
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
      report(`nag.sync.kickSync called`, "info", {
        source,
        onlineRefBefore: onlineRef.current,
        status: statusRef.current,
      });
      onlineRef.current = true;
      forceNextRunRef.current = true;
      kick(source);
    },
    [kick],
  );

  const resume = useCallback(async () => {
    logger.info("resume requested");
    report(`nag.sync.resume requested`, "info", {
      status: statusRef.current,
      onlineRef: onlineRef.current,
    });
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
      Sentry.captureException(e, { tags: { area: "sync" } });
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
      drainOutbox,
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
      drainOutbox,
      isAnonymous,
    ],
  );

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
};
