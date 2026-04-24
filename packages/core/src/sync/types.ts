export type DispatchStatus = "idle" | "running" | "halted" | "offline";

/**
 * Outbound envelope — matches the server's `CommandEnvelope` contract from
 * `@nag/api-client`. `timestamp` is an ISO string; the server accepts it and
 * transforms to a `Date` on its end.
 */
export type CommandEnvelope = {
  id: string;
  timestamp: string;
  type: string;
  payload: unknown;
};

/**
 * Normalized result from the dispatcher's injected `post` function. The app
 * layer translates axios / Zodios errors into this shape so the dispatcher
 * stays decoupled from any specific HTTP client.
 */
export type PostResult =
  | { ok: true; sequence: number }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

export type PostCommandsFn = (envelope: CommandEnvelope) => Promise<PostResult>;
