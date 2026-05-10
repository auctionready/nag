# Turborepo timings

Numbers gathered with Turborepo 2.9.12 layered over the existing scripts. Same machine, Node version, repo state as `baseline.md`.

## Delta vs baseline

| Command                                                             |        Baseline | Turbo cold |                   Turbo warm | Δ warm |
| ------------------------------------------------------------------- | --------------: | ---------: | ---------------------------: | -----: |
| `pnpm typecheck`                                                    |   6.74s / 0.56s |  **6.39s** |  **0.03s** (FULL TURBO 29ms) |   ~19× |
| `pnpm check:app` (no source change)                                 | 14.45s / 14.04s | **12.59s** | **0.12s** (FULL TURBO 117ms) |  ~120× |
| `pnpm check:app` after editing `packages/core/src/boardProgress.ts` |          15.12s |          — |                    **7.56s** |    ~2× |

## Setup landed in this commit

- Added `turbo` 2.9.12 as root devDep.
- New `turbo.json` defining tasks: `typecheck`, `test`, `check:circular`, `//#lint`, `//#format:check:app`. `typecheck` and `test` declare `dependsOn: ["^typecheck"]` so editing an upstream package invalidates downstream caches.
- Each package's `typecheck` script is `tsc --noEmit` (was: composite `tsc -b` at root).
- Dropped `composite: true` and project references from `tsconfig.json`s; per-package configs are now standalone.
- Added `typecheck` script to `app/package.json`.
- `eslint` and `prettier --check` use their own `--cache` flags as inner-loop caches; turbo wraps them as the outer cache.
- Root scripts:
  - `typecheck` → `turbo run typecheck`
  - `test:app` → `turbo run test --filter=!@nag/backend`
  - `check:app` → `turbo run typecheck test check:circular //#lint //#format:check:app --filter=!@nag/backend`
- `.gitignore`: added `.turbo/` and `.eslintcache`.

## Cache invalidation behaviour observed

Editing `packages/core/src/boardProgress.ts` runs:

- `@nag/core:typecheck` (own change)
- `@nag/core:test` (own change)
- `@nag/app:typecheck` (transitive via `^typecheck`)
- `@nag/app:test` (transitive via `^typecheck`)
- `//#lint` (file is in lint scope)
- `//#format:check:app` (file is in format scope)

Cached: `@nag/schema`, `@nag/api-client` typecheck/test, `@nag/app:check:circular` (5 of 11).

## Remote cache (Vercel free tier) — TODO before landing

Not wired up in this commit (requires interactive `turbo login`). To enable:

```bash
pnpm dlx turbo login
pnpm dlx turbo link            # pick a Vercel scope; creates .turbo/config.json (gitignored)
```

In CI (`.github/workflows/ci.yml`), expose secrets and turbo will auto-upload/download:

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Then `frontend-checks`, `frontend-test`, etc. can collapse to a single `pnpm check:app` step and rely on remote cache hits across PRs / re-runs.

Local also benefits: a teammate (or `claude` agent) starting fresh on the same SHA gets cache hits from the team's shared store.

Note: `TURBO_TOKEN` is currently set in this user's shell without `TURBO_TEAM`, which causes turbo to print "Remote caching disabled (TURBO_TOKEN set without TURBO_TEAM)". Either set both or unset both.

## Honest caveats

- **Cold check:app barely changed** (14.45s → 12.59s) because the work is the same; turbo just orchestrates. Wins are entirely on warm/affected paths.
- **Per-task cold time is slightly worse** for some tasks vs running directly (small per-task pnpm + turbo overhead), e.g. core test: 3.63s direct → 4.77s through turbo. Cached run is 28ms.
- **`//#lint` and `//#format:check:app` are root tasks** with broad input globs — touching almost any file invalidates them. To make them per-package would require splitting eslint/prettier scope per package (larger refactor, deferred).
- **CI not wired up yet** — current commit changes scripts but doesn't add remote-cache env vars to `ci.yml`. Should be a follow-up so we can measure CI re-run-on-same-SHA delta.
