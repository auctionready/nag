import type {
  EventEntry,
  PostResult,
  WriteEventEnvelope,
} from "@nag/api-client";

export type DispatchStatus =
  | "idle"
  | "running"
  | "halted"
  | "paused"
  | "offline";

/**
 * Re-exported from `@nag/api-client` so existing consumers can keep
 * importing from `@nag/core`. The shapes live next to the HTTP wrapper
 * that produces them.
 */
export type { EventEntry, PostResult, WriteEventEnvelope };

export type PostEventsFn = (
  envelope: WriteEventEnvelope,
) => Promise<PostResult>;
