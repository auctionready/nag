import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { getCalendars } from "expo-localization";
import { log } from "./log";

/**
 * Which screen the app opens on: the home board, or the calendar's
 * day view anchored on today.
 */
export type DefaultView = "board" | "day";

const DEFAULT_VIEW_KEY = "nag.preference.defaultView";
const CLOCK_24_KEY = "nag.preference.use24HourClock";

const logger = log("preferences");

const isDefaultView = (s: unknown): s is DefaultView =>
  s === "board" || s === "day";

// Module-level cache so `getDefaultView` is synchronous — the tabs
// layout reads it during its first render to pick the initial tab.
// `bootstrapPreferences` must resolve before that render (the root
// layout gates on it, alongside `bootstrapDevOverrides`).
let defaultView: DefaultView = "board";
// Until the user explicitly toggles the setting, follow the device's
// 12/24-hour convention (re-read each launch); a stored value wins.
let clock24 = false;
const listeners = new Set<() => void>();

const deviceClock24 = (): boolean => {
  try {
    return getCalendars()[0]?.uses24hourClock ?? false;
  } catch (error) {
    logger.warn("expo-localization read failed; assuming 12-hour clock", error);
    return false;
  }
};

/**
 * Load persisted preferences into the module cache. Call once at app
 * start, before the first router render.
 */
export const bootstrapPreferences = async (): Promise<void> => {
  clock24 = deviceClock24();
  try {
    const [storedView, storedClock] = await Promise.all([
      SecureStore.getItemAsync(DEFAULT_VIEW_KEY),
      SecureStore.getItemAsync(CLOCK_24_KEY),
    ]);
    if (isDefaultView(storedView)) defaultView = storedView;
    if (storedClock === "true" || storedClock === "false") {
      clock24 = storedClock === "true";
    }
  } catch (error) {
    logger.warn("SecureStore read failed; using default preferences", error);
  }
};

export const getDefaultView = (): DefaultView => defaultView;

/** Update the preference; persists in the background. */
export const setDefaultView = (view: DefaultView): void => {
  defaultView = view;
  for (const listener of listeners) listener();
  SecureStore.setItemAsync(DEFAULT_VIEW_KEY, view).catch((error) =>
    logger.warn("SecureStore write failed; preference not persisted", error),
  );
};

export const get24HourClock = (): boolean => clock24;

/** Update the preference; persists in the background. */
export const set24HourClock = (on: boolean): void => {
  clock24 = on;
  for (const listener of listeners) listener();
  SecureStore.setItemAsync(CLOCK_24_KEY, String(on)).catch((error) =>
    logger.warn("SecureStore write failed; preference not persisted", error),
  );
};

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/** Reactive read of the default-view preference (for the settings row). */
export const useDefaultView = (): DefaultView =>
  useSyncExternalStore(subscribe, getDefaultView);

/** Reactive read of the 24-hour-clock preference. */
export const use24HourClock = (): boolean =>
  useSyncExternalStore(subscribe, get24HourClock);
