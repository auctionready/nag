# Decision: Turborepo

Bake-off between Turborepo 2.9.12 and Nx 22.7.1 on the same baseline (`docs/perf/baseline.md`). Recommend **Turborepo** for this repo.

## Numbers

| Command                                      | Baseline |                  Turbo |     Nx | Winner |
| -------------------------------------------- | -------: | ---------------------: | -----: | ------ |
| `pnpm typecheck` cold                        |    6.74s |              **6.39s** | 10.61s | Turbo  |
| `pnpm typecheck` warm                        |    0.56s | **0.03s** (FULL TURBO) |  1.01s | Turbo  |
| `pnpm check:app` cold                        |   14.45s |             **12.59s** | 20.89s | Turbo  |
| `pnpm check:app` warm                        |   14.04s | **0.12s** (FULL TURBO) |  0.78s | Turbo  |
| `pnpm check:app` after editing one core file |   15.12s |              **7.56s** |  9.78s | Turbo  |

Cache hit rate after one-file edit identical (5 of 11 cached). Both correctly invalidate transitive consumers via `^typecheck` / `^src`.

## Why Turborepo wins here

1. **Faster on every dimension** — most importantly cold check:app (12.6s vs 20.9s). Nx adds ~6s of daemon/graph overhead that we don't recoup.
2. **Single config file** — `turbo.json` is ~50 lines and self-contained. Nx needed `nx.json` + a `package.json` `nx.includedScripts` workaround to stop the root project's auto-discovered `test` script from infinite-looping back into `nx run-many -t test`.
3. **Free remote cache simpler** — Vercel free tier with two env vars (`TURBO_TOKEN` + `TURBO_TEAM`). Nx Cloud free tier exists but has per-month cache-read limits; self-hosting requires community adapters.
4. **Less framework lock-in** — Turbo wraps existing scripts as-is. Nx ecosystem pushes toward Nx-flavoured generators / executors / migrations, which is more value if we wanted it but more cost if we don't.

## Where Nx would have been better

- If we wanted **affected-only commands** out of the box (`nx affected -t test --base=main`). Turbo has `--filter='[main...HEAD]'` but Nx's affected graph is more mature.
- If we wanted **flaky-test auto-detection** and **distributed task execution** (Nx Cloud features).
- If we were planning **multiple apps** with shared generators / Nx-managed migrations.

None of those apply to this repo today.

## Action

- Land the Turbo branch (`claude/monorepo-cache-bakeoff`) as a PR.
- Wire up Vercel remote cache as a follow-up PR (interactive `turbo login` step).
- Update `.github/workflows/ci.yml` to collapse `frontend-checks` + `frontend-test` into one `pnpm check:app` step once remote cache is enabled.
- Drop the Nx branch (`claude/monorepo-cache-bakeoff-nx`).
