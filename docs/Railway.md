# Hosting the Expo Dev Server on Railway

For ad-hoc remote testing — sharing a dev build with a teammate, or
connecting a physical device without a shared LAN — we can run the Expo
dev server on [Railway](https://railway.app). The Metro bundler is
exposed over a public URL via an ngrok tunnel that Expo opens
automatically when you pass `--tunnel`.

## How it works

- The [`Dockerfile`](../Dockerfile) at the repo root installs the full
  monorepo (including dev dependencies) and starts Metro with
  `expo start --tunnel --dev-client`.
- [`@expo/ngrok`](https://www.npmjs.com/package/@expo/ngrok) is
  installed as a **dev dependency** in
  [`app/package.json`](../app/package.json). It's never installed
  globally. Expo discovers it from `node_modules` the first time you
  pass `--tunnel`.
- Railway builds the image from the Dockerfile, as configured by
  [`railway.json`](../railway.json).
- When the container boots it prints a tunnel URL like
  `exp+nag://expo-development-client/?url=https%3A%2F%2F…ngrok.io`.
  Paste that into the Expo dev client on your device to connect.

## Deploying

1. Create a new Railway service pointing at this repo.
2. Railway detects [`railway.json`](../railway.json) and builds with
   the Dockerfile.
3. Watch the service logs for `Tunnel ready.` and the `exp://` URL
   printed below it.
4. Open the Expo dev client build on a device and enter that URL
   (or scan the QR code from the logs).

## Local equivalent

To reproduce the Railway run locally:

```bash
docker build -t nag-expo .
docker run --rm -p 8081:8081 nag-expo
```

Or, without Docker, the same command that Railway runs is available as
a script:

```bash
pnpm --filter @nag/app start:tunnel
```

## Environment variables

| Name              | Purpose                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | Injected by Railway. The Dockerfile passes it through to `expo start --port`. Defaults to `8081` when running under Docker.  |
| `NGROK_AUTHTOKEN` | Optional. Anonymous ngrok tunnels are rate-limited and get a random subdomain each boot. Set this for a stable reserved URL. |

## Caveats

- **Not a production deployment.** This is the dev server. Don't point
  app-store builds at it — use EAS for release builds.
- **Dev client only.** `--dev-client` means Expo Go will not connect;
  you need a custom dev-client build on the device (`eas build
--profile development`).
- **Cold starts are slow.** The first build installs the whole
  monorepo including native toolchains for `better-sqlite3`. Railway
  caches Docker layers, so subsequent deploys are faster.
- **Don't rely on Railway's public HTTPS URL.** Metro uses WebSockets
  and a custom protocol that doesn't survive Railway's HTTP proxy
  cleanly. Always use the ngrok tunnel URL printed to the logs.
