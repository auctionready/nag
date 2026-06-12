import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { log } from "./log";

/**
 * Which screen the app opens on: the home board, or the calendar's
 * day view anchored on today.
 */
export type DefaultView = "board" | "day";

const DEFAULT_VIEW_KEY = "nag.preference.defaultView";

const logger = log("preferences");

const isDefaultView = (s: unknown): s is DefaultView =>
  s === "board" || s === "day";

// Module-level cache so `getDefaultView` is synchronous — the tabs
// layout reads it during its first render to pick the initial tab.
// `bootstrapPreferences` must resolve before that render (the root
// layout gates on it, alongside `bootstrapDevOverrides`).
let defaultView: DefaultView = "board";
const listeners = new Set<() => void>();

/**
 * Load persisted preferences into the module cache. Call once at app
 * start, before the first router render.
 */
export const bootstrapPreferences = async (): Promise<void> => {
  try {
    const stored = await SecureStore.getItemAsync(DEFAULT_VIEW_KEY);
    if (isDefaultView(stored)) defaultView = stored;
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

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/** Reactive read of the default-view preference (for the settings row). */
export const useDefaultView = (): DefaultView =>
  useSyncExternalStore(subscribe, getDefaultView);
