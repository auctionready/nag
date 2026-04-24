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
import { isApiConfigured, postCommands } from "./apiClient";

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
      setPendingCount(p);
      setFailedCount(f);
      if (h) {
        setStatus("halted");
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }, []);

  const enabled = useMemo(() => isApiConfigured(), []);

  const runWithSingleflight = useMemo(() => {
    if (!enabled) return async () => {};
    const dispatcher = createDispatcher({
      db,
      post: postCommands,
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        setLastError(message);
        Sentry.captureException(err);
      },
    });
    const inner = async () => {
      if (!onlineRef.current) {
        setStatus("offline");
        await refreshCounts();
        return;
      }
      setStatus("syncing");
      try {
        const result: DispatchStatus = await dispatcher.run();
        if (result === "halted") setStatus("halted");
        else if (result === "offline") setStatus("offline");
        else setStatus("idle");
      } catch (e) {
        Sentry.captureException(e);
        setStatus("offline");
      } finally {
        await refreshCounts();
      }
    };
    return makeSingleflight(inner);
  }, [enabled, refreshCounts]);

  const kick = useCallback(() => {
    if (!enabled) return;
    void runWithSingleflight();
  }, [enabled, runWithSingleflight]);

  // NetInfo subscription: kick when we come online; reflect offline state.
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      const wasOffline = !onlineRef.current;
      onlineRef.current = online;
      if (online && wasOffline) {
        kick();
      } else if (!online) {
        setStatus("offline");
      }
    });
    // Also fetch the initial state so we don't wait for the first change.
    NetInfo.fetch().then((state) => {
      onlineRef.current =
        state.isConnected === true && state.isInternetReachable !== false;
      if (onlineRef.current) kick();
      else setStatus("offline");
    });
    return unsubscribe;
  }, [enabled, kick]);

  // AppState subscription: kick on transition to active.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") kick();
    });
    return () => sub.remove();
  }, [enabled, kick]);

  // Post-commit subscription.
  useEffect(() => {
    if (!enabled) return;
    return postCommitBus.subscribe(() => kick());
  }, [enabled, kick]);

  // Periodic safety-net timer while foregrounded.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") kick();
    }, SAFETY_TIMER_MS);
    return () => clearInterval(timer);
  }, [enabled, kick]);

  // Initial counts load (covers the case where we're online from the start
  // and the dispatcher runs once via NetInfo.fetch above).
  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const resume = useCallback(async () => {
    try {
      await resumeDispatch(db);
      setLastError(null);
      await refreshCounts();
      kick();
    } catch (e) {
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
