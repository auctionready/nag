# Nx timings

Numbers gathered with Nx 22.7.1 layered over the existing scripts. Same machine, Node version, repo state as `baseline.md`. Branch: `claude/monorepo-cache-bakeoff-nx`.

## Delta vs baseline

| Command                                                             |        Baseline |    Nx cold |   Nx warm | Δ warm |
| ------------------------------------------------------------------- | --------------: | ---------: | --------: | -----: |
| `pnpm typecheck`                                                    |   6.74s / 0.56s | **10.61s** | **1.01s** |    ~7× |
| `pnpm check:app` (no source change)                                 | 14.45s / 14.04s | **20.89s** | **0.78s** |   ~18× |
| `pnpm check:app` after editing `packages/core/src/boardProgress.ts` |          15.12s |          — | **9.78s** |  ~1.5× |

## Setup landed in this commit

- Added `nx` 22.7.1 as root devDep.
- New `nx.json` with `targetDefaults` for `typecheck`, `test`, `check:circular`, `lint`, `format:check:app`. Named inputs `src` and `sharedGlobals` for reuse. `typecheck` and `test` use `dependsOn: ["^typecheck"]` and `inputs: ["src", "^src"]` so editing an upstream package invalidates downstream caches.
- Each package's `typecheck` script is `tsc --noEmit` (was: composite `tsc -b` at root).
- Dropped `composite: true` and project references from `tsconfig.json`s.
- Added `typecheck` script to `app/package.json`.
- Root `package.json` gets `"nx": { "includedScripts": ["lint", "format:check:app"] }` to suppress auto-discovery of all root scripts as Nx targets (otherwise `nag:test` infinite-loops back into `nx run-many -t test`).
- Eslint and prettier use `--cache` flags as inner-loop caches; Nx wraps them as the outer cache.
- Root scripts:
  - `typecheck` → `nx run-many -t typecheck --exclude=@nag/backend`
  - `test:app` → `nx run-many -t test --exclude=@nag/backend`
  - `check:app` → `nx run-many -t typecheck test check:circular lint format:check:app --exclude=@nag/backend`
- `.gitignore`: added `.nx/` and `.eslintcache`.

## Cache invalidation behaviour observed

Editing `packages/core/src/boardProgress.ts` runs:

- `@nag/core:typecheck`, `@nag/core:test` (own change)
- `@nag/app:typecheck`, `@nag/app:test` (transitive via `^src`)
- `nag:lint`, `nag:format:check:app` (file in scope)

Cached: `@nag/schema`, `@nag/api-client` typecheck/test, `@nag/app:check:circular` (5 of 11).

Same shape as Turborepo.

## Remote cache (Nx Cloud free tier) — TODO before landing

Not wired up in this commit (requires `nx connect` interactive flow). The free workspace tier allows limited cache reads / CI minutes per month. Self-hosted alternative: community adapters (`nx-remotecache-s3`, `nx-remotecache-azure`, `nx-remotecache-minio`).

```bash
pnpm dlx nx connect      # creates Nx Cloud workspace, writes nxCloudId to nx.json
```

In CI, Nx auto-uses the cloud cache if `nxCloudId` is in `nx.json`. No env vars needed unless using read-only access tokens.

## Honest caveats — why Nx came out behind Turbo here

- **Cold `check:app` is 6s SLOWER than baseline** (14.45s → 20.89s). The Nx daemon's per-task startup and project graph build add overhead that the existing parallel `concurrently -g` setup didn't have.
- **Cold `pnpm typecheck` is 4s slower** than baseline (6.74s → 10.61s) and ~4s slower than Turbo (6.39s).
- **Warm runs are still fast** (~0.8s) but ~6× slower than Turbo's 117ms FULL TURBO.
- **Inferred targets are a foot-gun** — Nx automatically promotes every `package.json` script to a target. Hit this twice: first when `nag:test` recursed via `nx run-many -t test`; needed `nx.includedScripts: ["lint", "format:check:app"]` on root to suppress.
- **Cache invalidation needed manual `^src` input** — `dependentTasksOutputFiles` doesn't help when upstream produces no outputs (`tsc --noEmit`). Default Nx setup didn't invalidate downstream typecheck/test.
- **"Flaky task" detection** auto-fired when one stale-state run failed and the next passed. Useful in some shops, dangerous in others (can hide real intermittent bugs).
