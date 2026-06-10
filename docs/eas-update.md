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
  whose runtimeVersion matches the update's. We pin it from a **pre-computed
  fingerprint** (see below): any native change moves the fingerprint and an
  incompatible JS bundle simply won't land OTA — EAS reports "no compatible
  builds" instead, which is your signal to rebuild.

## runtimeVersion fingerprint (native policy)

`runtimeVersion` uses Expo's fingerprint policy:

```ts
// app/app.config.ts
runtimeVersion: { policy: "fingerprint" },
```

EAS computes the fingerprint with [`@expo/fingerprint`](https://github.com/expo/expo/tree/main/packages/@expo/fingerprint)
and **embeds it server-side** into the binary at build time; the CLI computes the
same hash when you run `eas update`. Both read `app/fingerprint.config.cjs`, so
they agree — no pre-computation, no generated file, no app-config indirection.

Only inputs that change the JS↔native contract move the hash: autolinked native
modules, native config in `app.config.ts`, the Expo SDK / React Native version,
and `package.json` scripts. Pure-JS/TS deps and source don't, so OTA keeps
working until something native actually changes.

- `app/fingerprint.config.cjs` is the tuning surface — `sourceSkips` /
  `ignorePaths` keep incidental churn (`.gitignore`, `eas.json`, the env-derived
  `extra` section) out of the hash. See the comments there for the rationale.
- To see the runtimeVersion a build/update would use:

  ```bash
  cd app && APP_VARIANT=preview eas fingerprint:generate --platform ios
  ```

### Guard: the workflow refuses to publish into the void

Before publishing, `eas-update.yml` computes the runtimeVersion with
`eas fingerprint:generate` and checks that at least one **finished** iOS build
exists on the target channel with it:

```bash
HASH=$(APP_VARIANT="$BRANCH" eas fingerprint:generate --platform ios --json | jq -re '.hash')
eas build:list --platform ios --channel "$BRANCH" --runtime-version "$HASH" --status finished --limit 1 --json
```

If none matches, the native layer changed since the last build and the update
would reach **0 devices** — the workflow fails with instructions to build first.
Dispatch with **`force = true`** to bypass the guard (e.g. when a matching build
is still in flight). Running `eas update` locally skips this guard, so check the
fingerprint against your last build yourself.

The `updates.url` in `app/app.config.ts` points at this project's EAS endpoint
(`https://u.expo.dev/<projectId>`). The dev/preview/prod variants share one
`projectId` and URL; they are isolated by **channel**, and their fingerprints
differ automatically because `APP_VARIANT` changes the native config.

## One-time prerequisite: rebuild once per channel

OTA can't be retrofitted onto an existing binary — a build must already contain
`expo-updates` and an embedded channel. After the config landed, you must build
**once** per channel the normal way and distribute that binary:

```bash
# from app/, or dispatch .github/workflows/eas-build.yml.
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

From then on, JS/asset changes ship via `eas update` until a native change bumps
the fingerprint.

## Day-to-day: publishing an update

Either dispatch the **EAS update** GitHub Actions workflow
(`.github/workflows/eas-update.yml`, choose `branch` = `preview` or `production`),
or run locally from `app/`. Pass `--environment` so the bundle is built with the
same hosted env the target build used:

```bash
# from app/
eas update --branch preview --environment preview --message "fix check-in copy"
```

> **Env footgun.** `eas update` does **not** read a build profile's `eas.json`
> `env` block. `--environment <branch>` loads the hosted env (`NAG_API_BASE_URL`,
> `EXPO_PUBLIC_*`, ...) so the bundle matches the target build; you still need
> `APP_VARIANT` to match (export it, or it's set by the CI workflow per branch).
> Without the right config the bundle ships pointed at the wrong API.
>
> Only `APP_VARIANT` affects the **fingerprint** (it changes the native bundle
> id / app name). `NAG_API_BASE_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
> flow into the config's `extra` section, which is deliberately excluded from the
> fingerprint (`ExpoConfigExtraSection` in `app/fingerprint.config.cjs`) — they
> are JS-runtime config, not a native-compatibility input. Hashing them used to
> make the runtimeVersion drift between where it was computed (with those vars
> unset) and where EAS recomputed it server-side (with the profile's hosted env
> applied), producing a "runtime version calculated on local machine not equal to
> runtime version calculated during build" mismatch.

> **No local guard.** The workflow blocks an update with no matching build; a
> local `eas update` does not. Check with
> `APP_VARIANT=preview eas fingerprint:generate --platform ios` and compare
> against your latest build's runtimeVersion before publishing.

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
