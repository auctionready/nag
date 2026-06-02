#!/usr/bin/env bash
#
# Upload JavaScript source maps to Sentry after a successful EAS build.
#
# We deliberately do NOT use @sentry/react-native's native build-phase upload
# (`sentry-cli react-native xcode`): that path is incompatible with Expo SDK 56
# / RN 0.85's Metro and crashes the iOS bundler with
# "Cannot read properties of undefined (reading 'transformFile')"
# (tracked in getsentry/sentry-react-native#6212). It is disabled via
# SENTRY_DISABLE_AUTO_UPLOAD=true in eas.json.
#
# Instead we re-export the production bundle + Hermes-composed source maps and
# upload them keyed by *debug id*. Debug ids are injected by the Sentry Metro
# serializer (see metro.config.mjs -> getSentryExpoConfig) and are derived from
# the bundle contents, so the map produced here matches the bundle embedded in
# the build without relying on release/dist matching (the historically flaky
# part). This step is best-effort: a Sentry-side failure logs a warning but
# never fails the build, since the build artifact itself is already good.

set -uo pipefail

cd "$(dirname "$0")/.."

# Only release builds embed a production (dev=false, Hermes) bundle whose debug
# ids match what `expo export` produces below. Dev-client builds don't, so
# uploading their maps would be useless.
if [ "${EAS_BUILD_PROFILE:-}" = "development" ]; then
  echo "[sentry] development profile - skipping source map upload"
  exit 0
fi

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "[sentry] SENTRY_AUTH_TOKEN not set - skipping source map upload"
  exit 0
fi

PLATFORM="${EAS_BUILD_PLATFORM:-ios}"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

echo "[sentry] exporting $PLATFORM bundle with source maps"
if ! CI=1 ./node_modules/.bin/expo export \
  --platform "$PLATFORM" \
  --source-maps \
  --output-dir "$OUT_DIR"; then
  echo "[sentry] expo export failed - skipping source map upload (non-fatal)"
  exit 0
fi

SENTRY_CLI="$(node --print "require('path').dirname(require.resolve('@sentry/cli/package.json')) + '/bin/sentry-cli'")"

# Idempotent: debug ids are normally already present from the Metro serializer.
node "$SENTRY_CLI" sourcemaps inject "$OUT_DIR" || true

echo "[sentry] uploading source maps to nag-stable/react-native"
if node "$SENTRY_CLI" sourcemaps upload \
  --org nag-stable \
  --project react-native \
  --debug-id-reference \
  --strip-prefix "$PWD" \
  "$OUT_DIR"; then
  echo "[sentry] source map upload complete"
else
  echo "[sentry] source map upload failed (non-fatal) - build artifact is unaffected"
fi

exit 0
