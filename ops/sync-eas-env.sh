#!/usr/bin/env bash
# Bind an EAS build environment to a Pulumi-managed backend stack by
# syncing `NAG_API_BASE_URL` from `pulumi stack output` into the named
# EAS environment.
#
# Each EAS build profile in `app/eas.json` declares an `environment`
# (development / preview / production); EAS injects that environment's
# variables at build time, where `app.config.ts` reads them into
# `expo.extra` and `app/src/infrastructure/apiClient.ts` consumes them.
# This script is what makes the binding happen.
#
#
# Usage:
#   ops/sync-eas-env.sh <pulumi-stack> <eas-environment>
#
# Examples:
#   ops/sync-eas-env.sh prod preview     # preview build → prod backend
#   ops/sync-eas-env.sh prod production  # prod build    → prod backend
#
# Idempotent — re-run after moving the backend behind a custom domain.
#
# Requires (and assumes already authenticated):
#   - pulumi CLI (PULUMI_ACCESS_TOKEN or `pulumi login`)
#   - eas-cli, run via `npx eas-cli` from `app/` (EXPO_TOKEN or `eas login`)

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <pulumi-stack> <eas-environment>" >&2
  echo "  e.g. $0 prod preview" >&2
  exit 64
fi

STACK="$1"
EAS_ENV="$2"

case "$EAS_ENV" in
  development|preview|production) ;;
  *)
    echo "error: <eas-environment> must be development, preview, or production (got: $EAS_ENV)" >&2
    exit 64
    ;;
esac

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
INFRA="$REPO_ROOT/infra"
APP="$REPO_ROOT/app"

echo "Reading values from Pulumi stack '$STACK'…"

# `apiUrl` is the canonical output (added when custom-domain support
# landed). Fall back to `invokeUrl` for stacks deployed before that, so
# the script keeps working until the next `pulumi up`.
API_URL=""
for output in apiUrl invokeUrl; do
  if API_URL="$(pulumi -C "$INFRA" stack output "$output" --stack "$STACK" 2>/dev/null)" \
     && [[ -n "$API_URL" ]]; then
    echo "  source = stack output '$output'"
    break
  fi
  API_URL=""
done

if [[ -z "$API_URL" ]]; then
  echo "error: stack '$STACK' has neither 'apiUrl' nor 'invokeUrl' output." >&2
  echo "       Run 'cd infra && pulumi up --stack $STACK' first." >&2
  exit 1
fi

echo "  apiUrl = $API_URL"
echo "Target  = EAS environment '$EAS_ENV'"

# eas-cli env subcommands operate on the project rooted at $APP.
cd "$APP"

upsert () {
  local name="$1" value="$2" visibility="$3"

  # Delete first (idempotent — `|| true` swallows "not found"). Use
  # --force to bypass the interactive confirmation; --non-interactive
  # alone is not enough on `env:delete`.
  npx --yes eas-cli env:delete \
    --variable-name "$name" \
    --variable-environment "$EAS_ENV" \
    --non-interactive --force \
    >/dev/null 2>&1 || true

  echo "Setting $name (visibility=$visibility) in '$EAS_ENV'…"
  npx --yes eas-cli env:create \
    --name "$name" \
    --value "$value" \
    --visibility "$visibility" \
    --environment "$EAS_ENV" \
    --non-interactive \
    >/dev/null
}

upsert NAG_API_BASE_URL "$API_URL" plaintext
