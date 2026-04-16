#!/usr/bin/env bash
# Fast-forward the VPS checkout to origin/$NAG_BRANCH and restart the Expo
# service if HEAD moved. Designed to be run by the `nag-deploy.timer` user
# timer every couple of minutes.
#
# Config (via systemd EnvironmentFile ~/.config/nag/deploy.env):
#   NAG_BRANCH    branch to track (default: main)
#   NAG_SERVICE   name of the user service to restart (default: nag-expo.service)
#
# This does a `git reset --hard`, so don't keep uncommitted work in the VPS
# checkout. Machine-local config lives in ~/.config/nag/, not in the repo.

set -euo pipefail

BRANCH="${NAG_BRANCH:-main}"
SERVICE="${NAG_SERVICE:-nag-expo.service}"

cd "$(dirname "$0")/.."

before=$(git rev-parse HEAD)
git fetch --quiet origin "$BRANCH"
target=$(git rev-parse "origin/$BRANCH")

if [ "$before" = "$target" ]; then
  exit 0
fi

git reset --hard --quiet "$target"
after=$(git rev-parse HEAD)

# Only reinstall dependencies if the lockfile actually moved — saves a minute
# or two per deploy in the common case.
if ! git diff --quiet "$before" "$after" -- pnpm-lock.yaml; then
  pnpm install --frozen-lockfile
fi

# Metro's file watcher will notice the reset, but restarting is cleaner: a
# hard reset can fire thousands of watcher events at once, and the dev client
# will reconnect automatically.
systemctl --user restart "$SERVICE"

printf 'nag: deployed %s -> %s\n' "$before" "$after"
