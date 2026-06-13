# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Build & Test

- Use [pnpm](https://pnpm.io/) for monorepo package management.
- Use pnpm to run Expo, e.g. `pnpm expo start` from `app`.
- Use dotnet for backend (install with apt if needed)

## Deployment

- Backend deployment is Pulumi and in two folders `infra` and `infra-bootstrap` both isolated from pnpm workspaces and npm projects.

## Integration backend with app

- OpenAPI from backend is used to generate zodios definitions.
- Generate `endpoint-definition.ts` using `pnpm --filter @nag/api-client generate` from the repo root.

## Validation (run from the repo root):

For backend:

```bash
pnpm check:backend
```

For mobile app:

```bash
pnpm check:app
```

### Running backend tests in a sandbox without Docker

The backend test suite uses Testcontainers to spin up a Postgres 17 container.
In sandboxes where Docker isn't available, set `NAG_TEST_PG_CONNECTION` to a
local Postgres connection string and `PostgresFixture` will skip Testcontainers
and target that instance directly.

Whatever database the connection string names, the fixture always creates and
runs against a dedicated `nag_auto_test` database on that instance (it connects
to the `postgres` maintenance db to create it), so it never writes into the
database you point it at. The connecting role just needs `CREATEDB`. Setup once
per fresh sandbox:

```bash
apt-get install -y postgresql-16   # pg17 if PGDG is reachable, otherwise 16
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER nag WITH PASSWORD 'nag' SUPERUSER;"
```

Local Postgres is shared across runs (unlike a per-session container), so test
schemas accumulate inside `nag_auto_test`. Either drop the whole database, or
drop the leftover schemas (test classes use an `api_*` or `proj_*` schema)
before each run:

```bash
PGPASSWORD=nag psql -h localhost -U nag -d postgres -c "DROP DATABASE IF EXISTS nag_auto_test;"
NAG_TEST_PG_CONNECTION="Host=localhost;Database=postgres;Username=nag;Password=nag" \
  dotnet test backend/Nag.Tests/Nag.Tests.csproj
```

## Architecture Overview

## Documentation

Project documentation lives in the [`docs/`](./docs) folder, linked from the
root [`README.md`](./README.md). Keep it up to date: when you change the
schema, domain model, architecture, or any behaviour described in `docs/`,
update the relevant doc in the same change. New significant subsystems
should get their own page under `docs/` and be linked from
[`docs/Intro.md`](./docs/Intro.md).

## Conventions & Patterns

- Use [drizzle-kit](https://orm.drizzle.team/docs/kit-overview) for mobile app database
  management.
- Use [drizzle-orm](https://orm.drizzle.team/docs/overview) for database access in mobile app.
- Use Wolverine and Marten for backend database access, messaging etc.

### Coding Style

- Prefer named exports over default exports.
- Prefer `const` style over `function` unless awkward.
- Test files for a given source file go in a `__tests__` folder next to the
  file they test.
- Pure algorithms (board progress, compliance, day cells, etc.) live in
  `packages/core/src/` as free functions with vitest tests in
  `packages/core/src/__tests__/`. App-side hooks just wire `useLiveQuery`
  results into the core function — they don't host the algorithm.

### Tests

- Prefer `describe` with `beforeEach` to set up scenarios, then one or more
  `it`s to assert.

## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues on `auctionready/nag` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout: `CONTEXT-MAP.md` at the repo root pointing to per-context `CONTEXT.md` files (e.g. `app/`, `backend/`). See `docs/agents/domain.md`.
