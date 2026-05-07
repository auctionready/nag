# Context Map

nag is a habit-tracking app with a local-first mobile client and a server-side
sync backend. The domain language is largely shared between the two.

## Contexts

- [Core domain](./CONTEXT.md) — the habit-tracking model that both the app and
  the backend speak: Habits, Goals, Schedules, Check-ins, Time slots, Skips,
  Outbox, Envelopes. This is the shared kernel.
- App context — `app/CONTEXT.md` (created lazily when app-only terms are
  resolved): UI-side concepts like the day strip, slot chips, traffic-light
  tile, sync banner, sync state machine.
- Backend context — `backend/CONTEXT.md` (created lazily when backend-only
  terms are resolved): server sequence, projections, Wolverine handlers,
  per-period summaries.

## Relationships

- **App → Backend**: the app pushes user-intent envelopes (one envelope = one
  outbox row) to the backend's `POST /events` endpoint via the outbox
  dispatcher.
- **Backend → App**: the app pulls server-assigned event sequences via
  pull-sync and per-period summary endpoints.
- **Shared kernel**: the entities and event payloads in [`CONTEXT.md`](./CONTEXT.md)
  are stable across both sides and must stay in lockstep.

## Further reading

- [`docs/Intro.md`](./docs/Intro.md) — narrative overview and current
  authoritative description of the model.
- [`docs/Model.md`](./docs/Model.md) — the SQLite schema (mobile side).
- [`docs/Backend.md`](./docs/Backend.md) — backend architecture.
