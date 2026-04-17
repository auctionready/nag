import { useEffect } from "react";
import { AppState, type NativeEventSubscription } from "react-native";
import { syncAllNotifications, type AnyDb } from "@nag/core";
import { db } from "../db";

const run = (database: AnyDb) => {
  syncAllNotifications(database).catch((err) => {
    // Swallow — a failed sync is non-fatal; the next mutation or foreground
    // event will try again.
    console.warn("syncAllNotifications failed", err);
  });
};

/**
 * Refill the one-shot notification window on every app foreground, and
 * once on mount so an upgrade from the old recurring-trigger world
 * replaces any stale OS-level schedules.
 */
export const useForegroundNotificationSync = (): void => {
  useEffect(() => {
    run(db);
    const sub: NativeEventSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") run(db);
      },
    );
    return () => sub.remove();
  }, []);
};
