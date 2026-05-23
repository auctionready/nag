# nag

A habit-tracking app built with Expo and React Native.

## Documentation

Project documentation lives in [`docs/`](./docs). Start with the
[Introduction](./docs/Intro.md) for an overview of what the app does and how
the code is organised.

## Quick Start

```bash
pnpm install
pnpm expo start      # from the app workspace
pnpm typecheck       # from root
pnpm test            # from root
```

See [`CLAUDE.md`](./CLAUDE.md) for AI-agent workflow rules and the
[`docs/`](./docs) folder for deeper dives.

## Isolated subprojects

A few directories are intentionally **not** part of the pnpm workspace —
they're plain `npm` projects with their own `package-lock.json`, dependencies,
and (where relevant) prettier/eslint config. They're excluded from the root
`prettier`/`eslint` runs and the lefthook pre-commit format hook:

- `blog/content/` — Astro site for nag.nz. Format with `npm run format` inside
  the directory; `prettier-plugin-astro` is installed locally only.
- `infra/`, `infra-bootstrap/` — Pulumi projects.

Install / format / build each one from inside its directory with `npm`.
