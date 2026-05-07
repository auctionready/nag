import {
  isErrorFromAlias,
  type ZodiosBodyByAlias,
  type ZodiosResponseByAlias,
} from "@zodios/core";
import type { NagApiClient } from "../client";
import { endpoints } from "../endpoint-definition";
import { failureFromError, type Endpoints, type WrapperLog } from "./shared";

/**
 * Wire shape of an outbound write envelope. Wider than the generated
 * Zodios `postEvents_Body` (whose `events` array is a discriminated union)
 * so the outbox dispatcher can ship whatever the auditor captured — the
 * server re-validates each event entry and rejects anything malformed
 * with a 400.
 */
export type EventEntry = {
  type: string;
  payload: unknown;
};

export type WriteEventEnvelope = {
  id: string;
  timestamp: string;
  events: EventEntry[];
};

/**
 * One event the server appended for an envelope, mirrored back on the
 * `POST /events` response (or fetched from
 * `GET /events/by-envelope/{id}`). Aliased to the generated Zodios
 * discriminated-union type — sequence + timestamp are server-assigned
 * and Zodios coerces `timestamp` to `Date` per the schema.
 */
export type AppendedEvent = NonNullable<
  ZodiosResponseByAlias<Endpoints, "postEvents">["events"]
>[number];

export type PostResult =
  | { ok: true; sequence: number; events: AppendedEvent[] }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

type PostEventsBody = ZodiosBodyByAlias<Endpoints, "postEvents">;
type PostEventsResponse = ZodiosResponseByAlias<Endpoints, "postEvents">;

/**
 * POSTs a write-event envelope and translates the response into a
 * `PostResult`. The server returns 201 (first time) or 200 (duplicate
 * replay) with an `EventsByEnvelope` body — the events the server
 * actually appended, with sequence + timestamp + payload. The wrapper
 * surfaces those events so the dispatcher can reconcile against its
 * optimistic local state without a follow-up GET.
 *
 * Never throws on HTTP or network errors — the caller (dispatcher)
 * reads `result.ok` and decides what to do.
 */
export const postEvents = async (
  client: NagApiClient,
  envelope: WriteEventEnvelope,
  log?: WrapperLog,
): Promise<PostResult> => {
  const types = envelope.events.map((e) => e.type).join(",");
  log?.debug?.(
    `POST /events id=${envelope.id} types=[${types}] timestamp=${envelope.timestamp}`,
  );
  const start = Date.now();
  try {
    const response: PostEventsResponse = await client.postEvents(
      envelope as PostEventsBody,
    );
    const elapsed = Date.now() - start;
    const events = response.events ?? [];
    const sequence = events.length > 0 ? events[events.length - 1].sequence : 0;
    log?.debug?.(
      `POST /events ok (${elapsed}ms) sequence=${sequence} events=${events.length}`,
    );
    return { ok: true, sequence, events };
  } catch (error: unknown) {
    return failureFromError(
      "POST /events",
      log,
      Date.now() - start,
      error,
      () => {
        if (isErrorFromAlias(endpoints, "postEvents", error)) {
          return error.response.data?.errors?.[0];
        }
        return undefined;
      },
    );
  }
};
