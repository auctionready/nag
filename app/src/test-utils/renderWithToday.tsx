import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react-native";
import { TodayProvider } from "../infrastructure/today";

/**
 * Render a component tree wrapped in the real `TodayProvider`, with the
 * system clock fixed at `now` so:
 *   - `useStartOfToday()` resolves to `startOfDay(now)`,
 *   - any in-tree `new Date()` calls (sub-day time-slot status, click-time
 *     captures) observe the same fixed instant.
 *
 * The caller is responsible for `jest.useFakeTimers()` setup and
 * `jest.useRealTimers()` cleanup — kept explicit so a stray fake-timer
 * leak from this helper can't poison unrelated tests in the same suite.
 */
export const renderWithToday = (
  ui: ReactElement,
  { now, ...options }: Omit<RenderOptions, "wrapper"> & { now: Date },
) => {
  jest.setSystemTime(now);
  return render(<TodayProvider>{ui}</TodayProvider>, options);
};
