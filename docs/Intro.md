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
- **Goal** — how often you want to do a habit, as a frequency per regularity
  (e.g. `3x week`, `1x day`).
- **Check-in** — a record that you did (or skipped) the habit at a point in
  time.
- **Schedule** — when to remind you about a goal (time of day, which days of
  the week or day of month).
- **Audit log** — a persistent record of commands processed by the domain
  layer, used for debugging and traceability.

See the [Model](./Model.md) doc for the full database schema and how these
entities relate.

## Further Reading

- [Model](./Model.md) — schema and entity relationships.
- [`CLAUDE.md`](../CLAUDE.md) — project conventions, coding style, tooling,
  and AI-agent workflow.
