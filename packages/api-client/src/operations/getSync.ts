import { type ZodiosResponseByAlias } from "@zodios/core";
import type { NagApiClient } from "../client";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

type GetSyncResponse = ZodiosResponseByAlias<Endpoints, "getSync">;

export type GetSyncResult =
  | { ok: true; response: GetSyncResponse }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

/**
 * GETs `/sync?since=<n>` and returns either a replay batch or a snapshot.
 * Never throws on HTTP/network errors — caller (pull-sync orchestrator)
 * decides what to do based on `result.ok`. Replay/snapshot dispatch is
 * the caller's responsibility.
 */
export const getSync = async (
  client: NagApiClient,
  since: number,
  log?: WrapperLog,
): Promise<GetSyncResult> => {
  log?.debug?.(`GET /sync since=${since}`);
  const start = Date.now();
  try {
    const response: GetSyncResponse = await client.getSync({
      queries: { since },
    });
    const elapsed = Date.now() - start;
    log?.debug?.(`GET /sync ok (${elapsed}ms) mode=${response.mode}`);
    return { ok: true, response };
  } catch (error: unknown) {
    return failureFromError(
      "GET /sync",
      log,
      Date.now() - start,
      error,
      () => undefined,
    );
  }
};
