import { useEffect } from "react";
import { AppState, type NativeEventSubscription } from "react-native";
import * as Notifications from "expo-notifications";
import { overdueHabitsCount, type AnyDb } from "@nag/core";
import { db } from "../db";

const update = (database: AnyDb) => {
  overdueHabitsCount(database)
    .then((count) => Notifications.setBadgeCountAsync(count))
    .catch((err) => {
      // Non-fatal: the next foreground or background transition will retry.
      console.warn("updateBadge failed", err);
    });
};

/**
 * Refresh the app-icon badge with the count of habits overdue today.
 * Runs on mount, on every foreground (so the badge reflects "now" when
 * the user returns), and on backgrounding (so the icon reflects any
 * check-ins made during the session).
 */
export const useBadgeSync = (): void => {
  useEffect(() => {
    update(db);
    const sub: NativeEventSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active" || state === "background") update(db);
      },
    );
    return () => sub.remove();
  }, []);
};
