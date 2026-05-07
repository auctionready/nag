# Core Domain

The habit-tracking model that both the mobile app and the backend speak.
This is the shared kernel — terms here are stable across both sides and
should not drift.

This file is the **opinionated** glossary. Narrative descriptions and
implementation detail live in [`docs/Intro.md`](./docs/Intro.md) and
[`docs/Model.md`](./docs/Model.md); when those disagree with this file,
this file wins and they should be updated.

## Language

**Habit**:
Something the user wants to do repeatedly (e.g. "Go for a run").
_Avoid_: Task, to-do, activity.

**Goal**:
A statement of how often a Habit should be done, plus optionally when.
A Goal carries a Regularity + Frequency for compliance, and zero or more
Schedules for reminders.
_Avoid_: Target, plan.

**Regularity**:
The repeating period a Goal is measured against — `day`, `week`, or `month`.
_Avoid_: Period, cadence (those are informal aliases).

**Frequency**:
How many times per Regularity the Habit should be done (e.g. `3` per `week`).
_Avoid_: Count, quota.

**Schedule**:
A recurring rule attached to a Goal that says "do this Habit on these
days-of-week at this Time slot". Drives reminders if reminders are enabled.
_Avoid_: Recurrence, plan, alarm.

**Time slot**:
The (hour, minute) intended time-of-day inside a Schedule. The user intends
to perform the Habit at around this time on the Schedule's days-of-week.
Time slots also drive notification consolidation: multiple Schedules sharing
the same day-of-week + Time slot are grouped into one push notification.
_Avoid_: Slot (ambiguous on its own), time, alarm time.

**Reminder**:
A push notification fired at a Schedule's Time slot when reminders are
enabled. Multiple Habits whose Schedules share a day-of-week + Time slot
produce one consolidated Reminder, not several.
_Avoid_: Notification (too generic), alert, ping.

**Check-in**:
A record that a Habit was performed (or deliberately Skipped) at a deemed
Time slot on a deemed Day. Carries the deemed slot calendrically (the
Day plus hour and minute, in device-local time) and a separate
recorded-at moment for when the row was inserted; these differ for
Back-fills. See [ADR-0001](./docs/adr/0001-calendrical-check-in-keys.md).
_Avoid_: Tick, log, completion.

**Skip**:
A Check-in flagged as deliberate non-performance. Counts the same as a
Check-in for Compliance — a Skip is not the same as silently doing nothing.
_Avoid_: Miss, no-show (those mean _silent_ missed slots).

**Back-fill**:
The act of recording a Check-in or Skip whose deemed slot time is _not_
the wall-clock moment of recording. Allowed for past unfilled slots and
today's nearest upcoming slot.
_Avoid_: Retroactive entry, late check-in.

**Compliance**:
The degree to which the user's Check-ins satisfy a Goal over the current
Regularity period. The number behind the Traffic-light indicator.
_Avoid_: Adherence, score.

**Traffic-light**:
A rudimentary visual rendering of Compliance as green / orange / red,
derived via `colorForRatio`. Note: this rendering is fading from the UI;
**Compliance** is the canonical underlying concept and should be the term
used in new work unless specifically referring to the legacy visual.
_Avoid_: Status indicator, badge.

**Command**:
A user-intent input processed by the domain layer (e.g. `CreateHabit`,
`CheckIn`). Has a discriminator + payload. One Command produces exactly
one Envelope and one or more Events.
_Avoid_: Action, intent, request.

**Envelope**:
The atomic transport and persistence unit produced by a Command. Carries
one or more past-tense Events; identified by `envelope_id` (idempotency
key) so the server can dedupe retries. One Command → one Envelope.
_Avoid_: Message, command, payload.

**Event**:
A past-tense fact produced by a Command (e.g. `HabitCreated`,
`CheckInCreated`). Always carried inside an Envelope; never sent on its
own. A single Command may produce multiple Events.
_Avoid_: Action, command, change.

**Outbox**:
The local persisted log of Envelopes. Plays two roles in one table: the
pending queue the dispatcher pushes to the server, and the retained audit
trail of recent user intents (sent rows kept up to a retention bound).
Each row is one Envelope.
_Avoid_: Audit log (retired — see Flagged ambiguities), pending queue, write log.

**Day**:
A calendar day in **device-local time**. All user-facing concepts —
"today", days-of-week, the day strip, back-fill targets, compliance
windows — are computed in device-local time, not UTC. (Future: the
user's timezone may be captured on their account and temporarily
overridable for travel.)
_Avoid_: Date (ambiguous about timezone), UTC day.

**Month**:
The calendar month in **device-local time**, used for monthly Regularity
compliance and the monthly traffic-light calculator. As with Day, "this
month" means the device-local month boundary, not UTC.
_Avoid_: UTC month.

**Server sequence**:
A monotonically increasing number assigned by the backend to each accepted
Envelope. The high-water mark drives Pull-sync.
_Avoid_: Server id, version.

**Sync**:
The two-way reconciliation between the local Outbox and the server.
Has two halves — a **Dispatcher** (push) and **Pull-sync** (pull) — and
one observable state at a time (Idle / Syncing / Offline / Halted /
Disabled).
_Avoid_: Replication, refresh.

**Dispatcher**:
The push half of Sync. Drains the Outbox by POSTing pending Envelopes to
`/events`, advancing them to `sent` (with their assigned Server sequence)
or marking them failed.
_Avoid_: Sender, pusher, uploader.

**Pull-sync**:
The pull half of Sync. Reads server events newer than the local high-water
mark and applies them locally. Also responsible for retention pruning of
old Check-ins once the Outbox is fully drained.
_Avoid_: Fetch, poll, download.

**Halted**:
A sticky non-progress state of Sync entered on a non-retriable failure
(4xx response or local JSON parse failure). Persists across runs via a
local flag and must be explicitly cleared by Resume. Distinct from
Offline (which is transient and auto-recovers).
_Avoid_: Failed, broken, stuck.

**Offline**:
A transient non-progress state of Sync due to network unavailability.
Auto-recovers when connectivity returns; no user action required.
_Avoid_: Disconnected (informal), down.

**Resume**:
The user action (Retry button on the sync banner) that clears the Halted
flag and triggers a fresh Sync attempt.
_Avoid_: Retry (the button label, but the domain action is "Resume"),
restart.

**Anonymous**:
The state of an install that has no persisted `accountId` — the user has
either never signed in or has signed out. Sync is **Disabled** in this
state and the sync UI hides rather than rendering an Offline state.
_Avoid_: Logged-out (informal), guest.

**Account**:
The server-side identity that owns a user's Habits, Goals, Check-ins,
etc. One human = one Account. Identified locally by `accountId`. An
Account may be used from multiple Devices simultaneously; switching
Device must not lose data or leave the new Device operating on stale
state. (Multi-device support is an explicit product goal; current
implementation may not fully meet it yet.)
_Avoid_: User (informal alias — the canonical term is Account in the
context of data ownership), profile.

**Device**:
A single install of the app. Tracked locally via a device ID and a
device token (used for push notifications and per-install Sync state).
Currently treated as plumbing rather than a first-class domain entity;
may be promoted to the glossary if multi-device sync introduces user-
visible per-Device behaviour.
_Avoid_: Install, client (informal).

## Relationships

- A **Habit** has many **Goals** (one per **Regularity**) and many **Check-ins**.
- A **Goal** belongs to one **Habit** and has zero or more **Schedules**.
- A **Schedule** belongs to one **Goal** and has exactly one **Time slot** plus a set of days-of-week.
- A **Check-in** belongs to one **Habit** and either a **Time slot** (if it lines up with one) or no **Time slot** (an unscheduled Check-in).
- A **Command** produces exactly one **Envelope** containing one or more **Events**.
- An **Envelope** lives in the **Outbox** until the backend acknowledges it with a **Server sequence**.
- **Sync** has two halves: the **Dispatcher** drains the **Outbox**, and **Pull-sync** applies remote **Events**.
- **Halted** is sticky and cleared by **Resume**; **Offline** is transient and clears itself.
- An **Anonymous** install has Sync **Disabled** entirely.

## Example dialogue

> **Dev:** "If two Habits both have a **Schedule** at 8 a.m. Monday, and the
> user taps the **Reminder**, what do they see?"
> **Domain expert:** "One consolidated **Reminder** opens the slot screen
> listing both Habits. They can **Check in** or **Skip** each one
> independently. Both Check-ins land at the same **Time slot**, which is
> 8 a.m. Monday."
>
> **Dev:** "And if they tap a missed 8 a.m. chip three days later?"
> **Domain expert:** "That's a **Back-fill**. The Check-in's deemed slot
> time is the past 8 a.m. Monday; its `created_at` is now."

## Flagged ambiguities

- **"Slot" vs "Time slot"** — "slot" alone is ambiguous (chip on the day
  strip, hour-minute bucket, screen name). Resolution: the canonical term
  is **Time slot**, which is a property of a **Schedule**. UI elements
  named "slot" (slot chip, slot screen) refer to _one occurrence of a
  Schedule's Time slot on a specific date_; if a domain term for that
  occurrence is needed, propose one before naming it loosely.
- **"Local day" vs "UTC day"** — `docs/Model.md` § check_in retention says
  pruning is "older than the start of the previous month (UTC)". Domain
  truth is **device-local**. ADR-0001 retires UTC timestamps from
  Check-in identity and restates retention in device-local terms; this
  ambiguity goes away once the ADR is implemented.
- **"Audit log" vs "Outbox"** — historically `docs/Intro.md` listed
  "Audit log" as a separate Core Concept. There is no separate audit-log
  table; the **Outbox** plays both the pending-queue role and the
  retained-audit-trail role. Resolution: retired "Audit log" as a domain
  term. The verb `audit()` in code is the function that writes to the
  Outbox.
