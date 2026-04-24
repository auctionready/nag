import type { CommandEnvelope, PostResult } from "@nag/api-client";

export type DispatchStatus = "idle" | "running" | "halted" | "offline";

/**
 * Re-exported from `@nag/api-client` so existing consumers can keep
 * importing from `@nag/core`. The shape lives next to the HTTP wrapper
 * that produces it.
 */
export type { CommandEnvelope, PostResult };

export type PostCommandsFn = (envelope: CommandEnvelope) => Promise<PostResult>;
