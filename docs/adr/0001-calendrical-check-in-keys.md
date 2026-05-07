---
status: proposed
---

# Check-ins are keyed calendrically, not by UTC timestamp

The user's domain is calendrical: Habits, Schedules, Time slots, and Days
exist in **device-local time** because users think and live in their own
timezone. Encoding a Check-in's deemed Time slot as a UTC ISO timestamp
forces every consumer (compliance calculators, slot matching, day-strip
chips) to round-trip through `Date` parsing under an implicit timezone,
re-introducing the very ambiguity we are trying to avoid — most visibly
on back-fills, where "8 a.m. Monday" is a calendrical coordinate, not a
moment.

## Decision

A Check-in carries its deemed slot as discrete calendrical fields:
`(deemed_date, deemed_hour, deemed_minute)`, all interpreted as
device-local. A separate `recorded_at` (UTC moment) records when the
row was inserted. The previous `timestamp` column is retired.

`Day` and `Month` follow the same rule: they are the device-local
calendar units, not UTC.

## Considered alternatives

- **Keep UTC `timestamp`, interpret in local TZ at read time.** Rejected:
  pushes TZ ambiguity to every reader, and means the _stored fact_ differs
  from the _domain fact_ — a back-fill for "8 a.m. Monday" stored as a
  UTC instant can read back as a different local time if the user
  travels.
- **Split Check-in into Scheduled vs Ad-hoc kinds.** Rejected for now:
  introduces polymorphism through commands, events, calculators, and UI
  for a benefit (cleaner DDD) that calendrical columns largely already
  capture.
- **Opaque slot-key string (`"2026-05-04T08:00"`, no TZ suffix).**
  Rejected: kicks parsing down the road; not directly indexable by date
  or by hour-of-day.

## Consequences

- Existing rows need migrating: each historical UTC `timestamp` is
  re-projected into `(deemed_date, deemed_hour, deemed_minute)` using
  the user's current device timezone at migration time. Imperfect for
  rows recorded in another TZ, but acceptable given the reduced-fidelity
  intent.
- The Sync wire format for Check-in events changes; backend handlers and
  projections must accept calendrical fields. Old events on the wire
  during the rollout need a one-shot translator.
- Travel timezone overrides (future) become a property of the
  _interpretation function_, not the stored data — the data is already
  calendrical and unambiguous, so a TZ change does not alter what slot
  a past Check-in occupies.
- Retention pruning, currently expressed as "older than the start of the
  previous month (UTC)", is restated in device-local terms. The
  ambiguity flagged in `CONTEXT.md` ("Local day vs UTC day") goes away.

## Open questions

- **Spontaneous Check-in slot derivation.** When the user taps "check
  in" with no slot selection, the deemed slot is currently derived at
  render time (the UI infers which Schedule's Time slot it lands on).
  Should this be decided and stored at _record time_ instead — e.g.
  find the closest unfilled Time slot for that Habit on the current
  Day — to make the deemed slot a fact rather than a derivation? Either
  way is "guessing", but storing the guess makes it auditable and
  consistent across UI surfaces.
- **Algorithm for the closest-unfilled rule**, if we adopt it: bias to
  past slots only? Tolerance window? Fallback when no Schedule on the
  current Day-of-week?
