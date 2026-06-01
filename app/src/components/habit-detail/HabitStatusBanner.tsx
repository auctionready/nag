import type { HabitStatus } from "@nag/schema";
import { dispatch } from "../../infrastructure/dispatch";
import { StatusBanner } from "./StatusBanner";

export interface HabitStatusBannerProps {
  habitId: string;
  status: HabitStatus;
}

/**
 * Smart status indicator for the habit detail screen: renders the dumb
 * {@link StatusBanner} and owns the lifecycle actions it offers (resume a
 * paused habit, unarchive an archived one). Renders nothing for an active
 * habit.
 */
export const HabitStatusBanner = ({
  habitId,
  status,
}: HabitStatusBannerProps) => (
  <StatusBanner
    status={status}
    onResume={() => dispatch({ type: "UnpauseHabit", habitId })}
    onUnarchive={() => dispatch({ type: "UnarchiveHabit", habitId })}
  />
);
