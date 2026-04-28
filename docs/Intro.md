# Introduction

**nag** is a habit-tracking app that reminds you to do the things you said you
wanted to do. You define habits, set goals for how often you want to perform
them, schedule reminders, and check in when you've done them. The app uses a
traffic-light system to show how well you're keeping up with each habit.

## Purpose

The point of nag is to help you **bed in habits**. Concretely, it aims to:

1. **Help you remember them** — keep the habits you care about visible so
   they don't quietly fall off the radar.
2. **Help you plan when you want to do them** — via goals (how often) and
   schedules (at what time, on which days of the week).
3. **Help by reminding you** — push notifications at the times you chose,
   grouped sensibly when several habits land in the same slot.
4. **Help you build a consistent cadence** — the app is oriented around
   repetition over time so that habits actually _form_ rather than being
   one-off to-dos.
5. **Help you see how you're doing at a glance** — a per-habit traffic-light
   indicator summarises compliance against the goal you set yourself.
6. **Reward the "clean screen" instinct** — for people who like tidy,
   ticked-off lists, the UI turns doing your habits into the obvious way to
   make the screen look clean, borrowing the satisfaction of a completed
   checklist to motivate the underlying behaviour.

## High-level Architecture

The repo is a pnpm workspace with three packages plus a .NET backend:

| Package            | Purpose                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `app/`             | The Expo / React Native application — screens, navigation, UI.                                          |
| `packages/schema/` | Drizzle ORM schema definitions and migrations (SQLite via expo-sqlite).                                 |
| `packages/core/`   | Domain logic: queries, commands, compliance, traffic-light calculators.                                 |
| `backend/`         | ASP.NET Core 10 + Marten/Wolverine API (AWS Lambda + Neon Postgres 17). See [Backend.md](./Backend.md). |

The app talks to SQLite through Drizzle, using the schema defined in
`@nag/schema` and the queries, commands, and domain helpers exported from
`@nag/core`.

## Core Concepts

- **Habit** — something you want to do (e.g. "Go for a run").
- **Goal** — how much and/or when you want to do a habit. See
  [Goals: frequency vs scheduled](#goals-frequency-vs-scheduled) below.
- **Check-in** — a record that you did the habit at a point in time. Check-ins
  can also be explicit **skips** — see
  [Check-ins and skips](#check-ins-and-skips).
- **Schedule** — a time slot (hour + minute) on one or more days of the week
  when the app should remind you about a goal. nag is not a calendar app, so
  schedules are weekday-based, not date-based.
- **Audit log** — a persistent record of commands processed by the domain
  layer, used for debugging and traceability.

See the [Model](./Model.md) doc for the full database schema and how these
entities relate.

## Goals: frequency vs scheduled

A goal can express "how often" in two complementary ways:

1. **Frequency goals** — "do this habit _N_ times per day / week / month."
   The regularity is one of `day`, `week`, or `month`, and the compliance
   calculator checks how many check-ins you've logged within the current
   period.
2. **Scheduled goals** — "remind me at _these specific times_ on _these days
   of the week_." A goal can have one or more schedules, each with its own
   time slot and set of weekdays. Schedules do not use day-of-month: nag
   intentionally is not a calendar.

The two styles coexist: a goal always has a frequency/regularity for
compliance tracking, and may _additionally_ have schedules that drive
reminders at specific times.

## Reminders and grouped check-ins

Each schedule can have reminders enabled (the default) or disabled. When
multiple habits have schedules whose reminders line up in the same time slot,
the app **consolidates** them into a single notification rather than firing
several at once. Tapping the consolidated notification opens a dedicated
slot-check-in screen that lists every habit due in that slot so you can check
them all in (or skip them) in one place.

See [`notificationConsolidator.ts`](../packages/core/src/notificationConsolidator.ts)
for the grouping logic and
[`app/src/app/check-in-slot.tsx`](../app/src/app/check-in-slot.tsx) for the
slot screen.

## Check-ins and skips

Every habit offers two actions:

- **Check in** — you did the habit. Logged as a `check_in` row with
  `skipped = false`.
- **Skip** — you're explicitly telling the app to treat this occurrence as
  handled without having done it. Logged as a `check_in` row with
  `skipped = true`.

A **skip is not the same as doing nothing**. Missing a check-in leaves the
habit "unaccounted for" and affects the traffic-light compliance indicator.
An explicit skip is stored and processed by the system like a check-in — it
satisfies the period from the calculator's point of view, so deliberate
skips won't drag your indicator down the way silent misses do.

### Back-filling missed slots

The habit detail screen shows each scheduled slot for the day as a chip
(green = done, orange = skipped, red ✕ = missed, white ○ = upcoming).
**Long-press** a back-fillable chip and a "Back-fill check-in?" prompt
opens with three options:

- **Check In** — record the slot as done.
- **As Skip** — record the slot as deliberately skipped.
- **Cancel** — do nothing.

Back-fill is enabled for past unfilled slots (red ✕) and for today's
**nearest upcoming** slot, so you can record "I'm doing it now" a few
minutes ahead. Later upcoming slots and every slot on a future-day view
intentionally have no back-fill affordance — you can't retroactively check
in on the future.

### Deemed time vs. recording time

Every `check_in` row carries two timestamps so back-fills are credited to
the right slot:

- **`timestamp`** is the **deemed slot time** — the slot the check-in
  counts towards. Normal "do it now" check-ins set this to the current
  moment; back-fills set it to the slot's hour/minute on the chosen day.
- **`created_at`** is the wall-clock time the row was inserted by the
  system, never overridable by the caller.

This means compliance counters and the per-day check-in lists key off
`timestamp` — so a back-filled 8 a.m. Monday check-in counts as 8 a.m.
Monday, not as the time you actually tapped the chip. See
[`Model.md` § check_in](./Model.md#check_in) for the schema details.

## Habit detail: day selection and period-scoped lists

The habit detail screen anchors its day-summary card and check-in list to
a **selected day**, modelled as a `?day=YYYY-MM-DD` route param so the
choice survives navigation and is bookmarkable. Tapping a day in the
weekly strip selects it; re-tapping clears the selection. For weekly
habits with day-of-week schedules the screen defaults to "today selected"
on first open so the strip and the slot chips line up visually.

The check-in list below the strip is **period-scoped and expanded by
default**. Its title adapts to context: `Today's Check-ins` / `This Week's
Check-ins` / `This Month's Check-ins` when no day is selected, or
`{Weekday}'s Check-ins` when one is. Days that have schedules but none
matching the selected day-of-week show a `Not scheduled` headline rather
than fall through to the period progress fallback (which would
misleadingly read "0 of N this period" on a day the habit isn't supposed
to fire).

Per-day cells in both the home-board tile (`DayIndicators`) and the habit
detail's week strip use a tri-state classifier
([`classifyScheduledDays`](../packages/core/src/dayCells.ts)):

- **Complete** (green) — every scheduled slot for that day-of-week has a
  check-in.
- **Partial** (orange) — some, but not all, of the day's slots are done.
- **Missed** (red) — past, scheduled, none done.
- **Unscheduled check-in** (dimmed green) — a check-in fell on a day that
  isn't part of the schedule. Rendered green at the same reduced opacity
  as the day's letter so it reads as "extra" rather than required.

## Further Reading

- [Model](./Model.md) — schema and entity relationships.
- [Dev Server Hosting](./DevServerHosting.md) — running the Expo dev
  server on a VPS behind Caddy or nginx, deployed on CI success.
- [`CLAUDE.md`](../CLAUDE.md) — project conventions, coding style, tooling,
  and AI-agent workflow.
