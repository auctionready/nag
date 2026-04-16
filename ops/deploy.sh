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

# Ensure node/pnpm are on PATH when invoked from non-interactive contexts
# (systemd timer, GitHub Actions SSH). mise shims live outside the default
# PATH and need explicit activation.
if [ -x "$HOME/.local/bin/mise" ]; then
  eval "$("$HOME/.local/bin/mise" activate bash)"
fi

# Ensure the systemd user bus is reachable — non-interactive SSH and
# systemd services don't inherit XDG_RUNTIME_DIR from a login session.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

# Load config from the EnvironmentFile if running outside of systemd
# (e.g. SSH from GitHub Actions, manual invocation).
if [ -z "${NAG_BRANCH:-}" ] && [ -f "$HOME/.config/nag/deploy.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$HOME/.config/nag/deploy.env"
  set +a
fi

BRANCH="${NAG_BRANCH:-main}"
SERVICE="${NAG_SERVICE:-nag-expo.service}"

cd "$(dirname "$0")/.."

# Guard 1: branch must exist on origin. Without this, a typo in
# NAG_BRANCH falls through to an opaque "couldn't find remote ref"
# error from git fetch — this version names the env var to fix.
if ! git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null; then
  echo "deploy.sh: origin has no branch '$BRANCH'." >&2
  echo "deploy.sh: check NAG_BRANCH in ~/.config/nag/deploy.env." >&2
  exit 2
fi

before=$(git rev-parse HEAD)
git fetch --quiet origin "$BRANCH"
target=$(git rev-parse "origin/$BRANCH")

if [ "$before" = "$target" ]; then
  exit 0
fi

# Guard 2: refuse to reset if the target tree doesn't contain this
# script. A branch without ops/ (e.g. NAG_BRANCH left at the default
# `main` while the VPS files live on a feature branch) would otherwise
# be reset into, wiping the systemd unit files and stranding the next
# deploy.
if ! git cat-file -e "$target:ops/deploy.sh" 2>/dev/null; then
  echo "deploy.sh: refusing to reset to $target (origin/$BRANCH)." >&2
  echo "deploy.sh: that commit has no ops/deploy.sh — resetting would" >&2
  echo "deploy.sh: wipe the VPS hosting files. Set NAG_BRANCH to the" >&2
  echo "deploy.sh: branch that carries the ops/ directory." >&2
  exit 2
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
