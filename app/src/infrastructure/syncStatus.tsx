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
import { AppState } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import * as Sentry from "@sentry/react-native";
import {
  createDispatcher,
  makeSingleflight,
  resumeDispatch,
  countPending,
  countFailed,
  isHalted,
  type DispatchStatus,
} from "@nag/core";
import { db } from "../db";
import { postCommitBus } from "./postCommitBus";
import { isApiConfigured, logApiConfig, postCommands } from "./apiClient";
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
};

const SAFETY_TIMER_MS = 60_000;

const SyncStatusContext = createContext<SyncStatusContextValue>({
  status: "disabled",
  pendingCount: 0,
  failedCount: 0,
  lastError: null,
  resume: async () => {},
});

export const useSyncStatus = () => useContext(SyncStatusContext);

export const SyncStatusProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<SyncUiStatus>("disabled");
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Keep a ref to the latest online state so the dispatcher can bail out
  // immediately if we go offline mid-run.
  const onlineRef = useRef<boolean>(true);

  const refreshCounts = useCallback(async () => {
    try {
      const [p, f, h] = await Promise.all([
        countPending(db),
        countFailed(db),
        isHalted(db),
      ]);
      logger.debug(`counts pending=${p} failed=${f} halted=${h}`);
      setPendingCount(p);
      setFailedCount(f);
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
      post: postCommands,
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("dispatcher onError", message);
        setLastError(message);
        Sentry.captureException(err);
      },
    });
    const inner = async () => {
      const runId = ++runIdRef.current;
      activeRunRef.current = runId;
      logger.debug(`run[${runId}] enter`);
      if (!onlineRef.current) {
        logger.debug(`run[${runId}] skipped — offline`);
        setStatus("offline");
        await refreshCounts();
        activeRunRef.current = null;
        return;
      }
      logger.debug(`run[${runId}] start`);
      setStatus("syncing");
      const started = Date.now();
      try {
        const result: DispatchStatus = await dispatcher.run();
        logger.info(
          `run[${runId}] complete (${Date.now() - started}ms) result=${result}`,
        );
        if (result === "halted") setStatus("halted");
        else if (result === "offline") setStatus("offline");
        else setStatus("idle");
      } catch (e) {
        logger.error(`run[${runId}] threw (${Date.now() - started}ms)`, e);
        Sentry.captureException(e);
        setStatus("offline");
      } finally {
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

  const resume = useCallback(async () => {
    logger.info("resume requested");
    try {
      await resumeDispatch(db);
      setLastError(null);
      await refreshCounts();
      kick("resume");
    } catch (e) {
      logger.error("resume failed", e);
      Sentry.captureException(e);
    }
  }, [kick, refreshCounts]);

  const value = useMemo<SyncStatusContextValue>(
    () => ({
      status: enabled ? status : "disabled",
      pendingCount,
      failedCount,
      lastError,
      resume,
    }),
    [enabled, status, pendingCount, failedCount, lastError, resume],
  );

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
};
