# Introduction

**nag** is a habit-tracking app that reminds you to do the things you said you
wanted to do. You define habits, set goals for how often you want to perform
them, schedule reminders, and check in when you've done them. The app uses a
traffic-light system to show how well you're keeping up with each habit.

## High-level Architecture

The repo is a pnpm workspace with three packages:

| Package            | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `app/`             | The Expo / React Native application — screens, navigation, UI.          |
| `packages/schema/` | Drizzle ORM schema definitions and migrations (SQLite via expo-sqlite). |
| `packages/core/`   | Domain logic: queries, commands, compliance, traffic-light calculators. |

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

## Further Reading

- [Model](./Model.md) — schema and entity relationships.
- [`CLAUDE.md`](../CLAUDE.md) — project conventions, coding style, tooling,
  and AI-agent workflow.
