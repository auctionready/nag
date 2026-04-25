# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Issue Tracking: bd vs GitHub Issues

The rules above about using `bd` apply **only to work you are actively
doing** — the in-flight task you've claimed, its sub-tasks, and anything
you need to track within the current session.

**Backlog items go in GitHub Issues, not `bd`.** If you uncover follow-up
work, tech debt, or a proposal that isn't part of the current task, file
it as a GitHub issue in `auctionready/nag` instead of a `bd` issue. `bd`
is for the work you're holding in your hands right now; GitHub Issues is
for the queue of things somebody might pick up later.

Rule of thumb:

- **Actively working on it (or will be, in this session)** → `bd`.
- **"We should do this some day"** → GitHub Issues.

## Build & Test

- Use [pnpm](https://pnpm.io/) for package management.
- Use pnpm to run Expo, e.g. `pnpm expo start`.

Validation (run from the repo root):

```bash
pnpm typecheck
pnpm test
```

After changing backend endpoints or contracts, regenerate the OpenAPI spec
and typed client with `pnpm --filter @nag/api-client generate` (commit both
`packages/api-client/openapi.json` and `src/endpoint-definition.ts`). If
running in a sandbox without `dotnet`, install it via
`sudo apt-get install -y dotnet-sdk-10.0`.

## Architecture Overview

_Add a brief overview of your project architecture_

## Documentation

Project documentation lives in the [`docs/`](./docs) folder, linked from the
root [`README.md`](./README.md). Keep it up to date: when you change the
schema, domain model, architecture, or any behaviour described in `docs/`,
update the relevant doc in the same change. New significant subsystems
should get their own page under `docs/` and be linked from
[`docs/Intro.md`](./docs/Intro.md).

## Conventions & Patterns

- Use [drizzle-kit](https://orm.drizzle.team/docs/kit-overview) for database
  management.

### Coding Style

- Prefer named exports over default exports.
- Prefer `const` style over `function` unless awkward.
- Test files for a given source file go in a `__tests__` folder next to the
  file they test.

### Tests

- Prefer `describe` with `beforeEach` to set up scenarios, then one or more
  `it`s to assert.
