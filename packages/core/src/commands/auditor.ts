import { outbox } from "@nag/schema";
import type { AnyDb } from "../db";
import type { Event } from "../events";

/**
 * Shape every handler returns: the past-tense events the user-intent
 * produced, ready to be written to the outbox as a single envelope.
 */
export type HandlerEventsContext = { events: Event[] };

type ScheduleEntryWire = {
  hour: number;
  minute: number;
  days: number | null;
  dayOfMonth: number | null;
  reminder: boolean | null;
};

type GoalPayloadWire = {
  regularity: "day" | "week" | "month";
  frequency: number | null;
  schedules: ScheduleEntryWire[] | null;
};

type EventPayload =
  | { habitId: string; title: string }
  | {
      habitId: string;
      title: string;
      description: string | null;
      icon: string | null;
      goal: GoalPayloadWire | null;
    }
  | Record<string, unknown>;

/**
 * Persists the events the handler emitted as a single outbox envelope row
 * in `pending` state. The dispatcher reads `events` (JSON-encoded
 * `[{type, payload}, ...]`), wraps it in a `WriteEventEnvelope`, and POSTs
 * to `/events`. `envelope_id` and `timestamp` are set by the table's
 * `$defaultFn`s.
 */
export async function audit(
  db: AnyDb,
  result: HandlerEventsContext,
): Promise<void> {
  if (result.events.length === 0) return;

  const entries = result.events.map((e) => ({
    type: e.type,
    payload: payloadOf(e),
  }));

  await db.insert(outbox).values({ events: JSON.stringify(entries) });
}

/** Strip the discriminator and turn Date timestamps into ISO strings. */
function payloadOf(event: Event): EventPayload {
  // Spread copies all event-specific fields; we drop `type` (it lives at
  // the entry level) and ISO-format any timestamp fields.
  const { type: _type, ...rest } = event;
  void _type;
  const payload: Record<string, unknown> = { ...rest };
  for (const [k, v] of Object.entries(payload)) {
    if (v instanceof Date) payload[k] = v.toISOString();
  }
  return payload as EventPayload;
}
