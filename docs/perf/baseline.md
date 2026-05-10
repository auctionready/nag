# Baseline timings — monorepo cache bake-off

Captured on branch `claude/monorepo-cache-bakeoff` at the first commit (no tooling changes yet) so Turborepo and Nx can be compared against the same numbers.

## Environment

- macOS 26.4.1 (Darwin 25.4.0, arm64)
- Node v24.14.1
- pnpm 10.33.2
- Repo: `nag` @ `main` HEAD (cdf9ef2)

## Method

- All times are `time` real wall-clock.
- "Cold" typecheck = `*.tsbuildinfo` files deleted first.
- "Warm" = re-run immediately after the previous run.
- `check:app` runs `typecheck`, `lint`, `test:app`, `format:check:app`, `check:circular` in parallel via `concurrently -g`.

## Numbers

| Command                                                              |       Cold |       Warm |
| -------------------------------------------------------------------- | ---------: | ---------: |
| `pnpm typecheck` (`tsc -b` composite)                                |  **6.74s** |  **0.56s** |
| `pnpm --filter @nag/core test` (vitest, 28 files / 398 tests)        |  **3.63s** |          — |
| `pnpm --filter @nag/schema test` (vitest, 1 file / 17 tests)         |  **1.71s** |          — |
| `pnpm --filter @nag/api-client test` (vitest, 2 files / 33 tests)    |  **5.14s** |          — |
| `pnpm --filter @nag/app test` (jest, 18 files / 190 tests)           |  **8.18s** |          — |
| `pnpm lint` (eslint, no `--cache`)                                   |  **9.58s** |          — |
| `pnpm format:check:app` (prettier, no `--cache`)                     |  **2.70s** |          — |
| `pnpm check:app` (all five concurrently)                             | **14.45s** | **14.04s** |
| `pnpm check:app` after touching `packages/core/src/boardProgress.ts` | **15.12s** |          — |

## Observations

- `tsc -b` composite already gives ~12× speedup on warm typecheck (6.74s → 0.56s). Caching tsc beyond that has limited room.
- `check:app` wall time is dominated by `lint` (9.6s) and `app jest` (8.2s) running concurrently. Total stays ~14s cold/warm/after-edit because **nothing else caches** — every run re-lints the whole tree, re-runs all jest suites, re-runs all vitest suites.
- The biggest realistic wins for a content-hash cache:
  - **Warm `check:app`** (no source change): currently 14s, theoretical floor ~0s if all 5 tasks cache-hit.
  - **One-file change in `packages/core`**: currently 15s, theoretical floor = only `core` + `app` re-run, others (schema, api-client, lint of unchanged files) cache-hit.
  - **CI re-run on same SHA**: currently full ~14s, theoretical floor ~seconds with remote cache.
