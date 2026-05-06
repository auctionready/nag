import type { AnyDb } from "../db";
import { getAccountId } from "../identity/identity";
import { applyServerEvent, type ServerEvent } from "./applyServerEvent";
import { installSnapshot, type ServerSnapshot } from "./installSnapshot";
import { getHighestServerSequence, isHalted } from "./outbox";
import { syncAllNotifications } from "../notificationConsolidator";
import { pruneOldCheckInsIfSafe } from "../retention";

/**
 * Whether to prune old check-ins after each pull-sync. Off by default so
 * the local DB keeps full history; set `NAG_PRUNE_OLD_CHECKINS=1` (or
 * `true`) to re-enable. Read at module load to mirror
 * `NAG_SENT_OUTBOX_RETAIN`'s pattern.
 */
export const PRUNE_OLD_CHECKINS_ENABLED: boolean = readPruneEnv();

function readPruneEnv(): boolean {
  const raw =
    typeof process !== "undefined"
      ? process.env?.NAG_PRUNE_OLD_CHECKINS
      : undefined;
  if (raw === undefined || raw === "") return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export type PullStatus = "idle" | "halted" | "offline";

/**
 * Server response from `GET /sync?since=N` — flat shape so it survives
 * `JsonIgnoreCondition.WhenWritingNull` + Swashbuckle + openapi-zod-client
 * cleanly. `mode` is the discriminator; the rest of the fields are
 * populated according to the mode and arrive as `undefined` when omitted.
 */
export type SyncResult = {
  mode: "replay" | "snapshot" | string;
  events?: ServerEvent[] | null;
  headSequence?: number | null;
  nextSince?: number | null;
  sequenceAtSnapshot?: number | null;
  snapshot?: ServerSnapshot | null;
};

export type GetSyncFn = (
  since: number,
) => Promise<
  | { ok: true; response: SyncResult }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string }
>;

export type PullSyncOptions = {
  db: AnyDb;
  getSync: GetSyncFn;
  /**
   * Maximum number of `getSync` round-trips per `run()`. Replay mode pages
   * via `nextSince`; this guard stops a hypothetical never-ending stream
   * from monopolising the pull. Default 5.
   */
  maxPages?: number;
  log?: {
    debug?: (msg: string, ...args: unknown[]) => void;
    info?: (msg: string, ...args: unknown[]) => void;
    error?: (msg: string, ...args: unknown[]) => void;
  };
};

export type PullSync = {
  run: () => Promise<PullStatus>;
};

/**
 * Pull-sync orchestrator: queries `GET /sync?since=<highWaterMark>`,
 * dispatches on `mode`, and loops while the server hands back more pages.
 * Caller (e.g. `syncStatus.tsx`) is expected to drain the outbox FIRST so
 * snapshot mode doesn't stomp pending local commands.
 */
export const createPullSync = ({
  db,
  getSync,
  maxPages = 5,
  log,
}: PullSyncOptions): PullSync => {
  const debug = log?.debug ?? (() => {});
  const error = log?.error ?? (() => {});

  const run = async (): Promise<PullStatus> => {
    // Mirror the dispatcher's gate: when the user is signed out (no
    // accountId yet, or just cleared via clearLocalAuth), don't fire a
    // GET /sync — it would either 401 or hit a retired token. Treat
    // anonymous as "offline" so the existing safety-timer/AppState
    // machinery resumes pulling automatically once sign-in restores
    // the accountId.
    const accountId = await getAccountId(db);
    if (!accountId) {
      debug("pullSync.run: no accountId — anonymous, treating as offline");
      return "offline";
    }

    if (await isHalted(db)) {
      debug("pullSync.run: halted — skipping");
      return "halted";
    }

    let mutated = false;

    for (let page = 0; page < maxPages; page++) {
      const since = await getHighestServerSequence(db);
      debug(`pullSync.run: page=${page} since=${since}`);
      const result = await getSync(since);
      if (!result.ok) {
        if (result.kind === "non-retriable") {
          error(
            `pullSync.run: non-retriable status=${result.status} message=${result.message}`,
          );
          // Pull doesn't halt the queue — pull failures don't risk data
          // loss the way push 4xx do. Treat as offline so the safety
          // timer retries.
          return "offline";
        }
        debug(`pullSync.run: transient — ${result.message}`);
        return "offline";
      }

      const response = result.response;
      if (response.mode === "snapshot") {
        const seq = response.sequenceAtSnapshot ?? 0;
        const snapshot = response.snapshot ?? { habits: [] };
        debug(`pullSync.run: snapshot mode sequenceAtSnapshot=${seq}`);
        await installSnapshot(db, seq, snapshot);
        mutated = true;
        // Snapshot is terminal — server wouldn't have sent it if there
        // was anything more after `sequenceAtSnapshot`.
        break;
      }

      if (response.mode !== "replay") {
        error(`pullSync.run: unknown mode "${response.mode}"`);
        return "offline";
      }

      const events = response.events ?? [];
      debug(
        `pullSync.run: replay mode events=${events.length} headSequence=${response.headSequence ?? "(none)"} nextSince=${response.nextSince ?? "(none)"}`,
      );
      for (const event of events) {
        await applyServerEvent(db, event);
        mutated = true;
      }
      // `nextSince` arrives as `undefined` (server omits null fields) when
      // there are no more pages.
      if (response.nextSince == null || events.length === 0) {
        break;
      }
    }

    if (mutated) {
      try {
        await syncAllNotifications(db);
      } catch (e) {
        error("pullSync.run: syncAllNotifications threw", e);
        // Notification scheduling failures shouldn't poison the sync —
        // data is already committed. Caller will surface via Sentry.
      }
    }

    // Drop check-ins older than the start of the previous month — but only
    // when the outbox is fully drained, so we never lose a row whose
    // CreateCheckIn hasn't been acknowledged. Pruned periods can be
    // re-fetched from the per-period summary endpoints on demand. Disabled
    // by default; opt in via `NAG_PRUNE_OLD_CHECKINS=1`.
    if (PRUNE_OLD_CHECKINS_ENABLED) {
      try {
        await pruneOldCheckInsIfSafe(db);
      } catch (e) {
        error("pullSync.run: pruneOldCheckInsIfSafe threw", e);
      }
    }

    return "idle";
  };

  return { run };
};
