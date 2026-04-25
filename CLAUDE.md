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

### Tests

- Prefer `describe` with `beforeEach` to set up scenarios, then one or more
  `it`s to assert.
