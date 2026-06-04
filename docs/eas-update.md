# EAS Update (over-the-air JS updates)

This app ships JS/asset-only changes **over the air** with
[EAS Update](https://docs.expo.dev/eas-update/introduction/), so most changes
reach testers (and prod) without a full native [EAS Build](./deploy-testflight.md)
and re-install/re-submit. A new native build is only needed when the native layer
actually changes.

## How it fits together

Three concepts do the work:

- **Channel** — baked into a build at build time (`channel` in `app/eas.json`).
  A build only ever listens to its channel. Our profiles map:
  `preview` build → `preview` channel, `production` build → `production` channel.
- **Branch** — the target you publish to with `eas update --branch <name>`. EAS
  maps a channel to a branch (defaults to the same name), so publishing to branch
  `preview` reaches every build on channel `preview`.
- **runtimeVersion** — the compatibility gate. An update only installs on a build
  whose runtimeVersion matches the update's. We use the **`fingerprint`** policy
  (`app/app.config.ts`): EAS hashes the native layer, so any native change moves
  the fingerprint automatically and an incompatible JS bundle simply won't land
  OTA — EAS reports "no compatible builds" instead, which is your signal to rebuild.

The `updates.url` in `app/app.config.ts` points at this project's EAS endpoint
(`https://u.expo.dev/<projectId>`). The dev/preview/prod variants share one
`projectId` and URL; they are isolated by **channel**, and their fingerprints
differ automatically because `APP_VARIANT` changes the native config.

## One-time prerequisite: rebuild once per channel

OTA can't be retrofitted onto an existing binary — a build must already contain
`expo-updates` and an embedded channel. After the config landed, you must build
**once** per channel the normal way and distribute that binary:

```bash
# from app/, or dispatch .github/workflows/eas-build.yml
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

From then on, JS/asset changes ship via `eas update` until a native change bumps
the fingerprint.

## Day-to-day: publishing an update

Either dispatch the **EAS update** GitHub Actions workflow
(`.github/workflows/eas-update.yml`, choose `branch` = `preview` or `production`),
or run locally from `app/`:

```bash
eas update --branch preview --message "fix check-in copy"
```

> **Env footgun.** `eas update` does **not** read a build profile's `eas.json`
> `env` block. The published bundle must be built with the same `APP_VARIANT` /
> `EXPO_PUBLIC_*` / `NAG_API_BASE_URL` the target build used, or it will mismatch
> (wrong config and a different fingerprint). The CI workflow sets these per
> branch — keep them in sync with `app/eas.json`. When running locally, export
> the same values (e.g. `APP_VARIANT=preview`) before `eas update`.

## When you must rebuild instead of updating

A new `eas build` (not an update) is required whenever the native layer changes,
because the fingerprint runtimeVersion moves and existing builds won't accept the
update:

- Adding/removing/upgrading a package with native code (a new Expo module, etc.).
- Adding or changing a config plugin, or its options.
- Changing native config in `app.config.ts` (bundleId, `infoPlist`, plugin modes).
- Bumping the Expo SDK or React Native version.

Pure JS/TS, React components, styles, images, and JSON ship via `eas update`.

## Rollback

Republish a previous update to a branch, or roll back from the EAS dashboard:

```bash
eas update --branch preview --republish
```
