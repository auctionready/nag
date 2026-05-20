#!/usr/bin/env bash
# Fast-forward the VPS checkout to origin/<branch> and restart the Expo
# service if HEAD moved. Invoked over SSH by the `deploy-vps-callable.yml`
# GitHub Actions workflow.
#
# Usage:  deploy.sh [BRANCH]
#
# Branch precedence:
#   1. First positional argument, if given
#   2. $NAG_BRANCH from the environment
#   3. $NAG_BRANCH from ~/.config/nag/deploy.env
#   4. "main"
#
# Other config (via ~/.config/nag/deploy.env):
#   NAG_SERVICE   name of the user service to restart (default: nag-expo.service)
#
# This does a `git reset --hard`, so don't keep uncommitted work in the VPS
# checkout. Machine-local config lives in ~/.config/nag/, not in the repo.

set -euo pipefail

# Non-interactive SSH sessions don't source ~/.bashrc, so mise shims
# (node, pnpm) aren't on PATH. Activate mise explicitly.
if [ -x "$HOME/.local/bin/mise" ]; then
  eval "$("$HOME/.local/bin/mise" activate bash)"
fi

# Non-interactive SSH sessions also don't inherit XDG_RUNTIME_DIR, which
# `systemctl --user` needs to find the user bus.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

if [ -z "${NAG_BRANCH:-}" ] && [ -f "$HOME/.config/nag/deploy.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$HOME/.config/nag/deploy.env"
  set +a
fi

BRANCH="${1:-${NAG_BRANCH:-main}}"
SERVICE="${NAG_SERVICE:-nag-expo.service}"

cd "$(dirname "$0")/.."

# Guard 1: branch must exist on origin. Without this, a typo falls
# through to an opaque "couldn't find remote ref" error from git fetch.
if ! git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null; then
  echo "deploy.sh: origin has no branch '$BRANCH'." >&2
  echo "deploy.sh: pass a valid branch as the first argument, or set" >&2
  echo "deploy.sh: NAG_BRANCH in ~/.config/nag/deploy.env." >&2
  exit 2
fi

before=$(git rev-parse HEAD)
git fetch --quiet origin "$BRANCH"
target=$(git rev-parse "origin/$BRANCH")

if [ "$before" != "$target" ]; then
  # Guard 2: refuse to reset if the target tree doesn't contain this
  # script. A branch without ops/ would otherwise be reset into, wiping
  # the hosting files and stranding the next deploy.
  if ! git cat-file -e "$target:ops/deploy.sh" 2>/dev/null; then
    echo "deploy.sh: refusing to reset to $target (origin/$BRANCH)." >&2
    echo "deploy.sh: that commit has no ops/deploy.sh — resetting would" >&2
    echo "deploy.sh: wipe the VPS hosting files. Deploy a branch that" >&2
    echo "deploy.sh: carries the ops/ directory." >&2
    exit 2
  fi

  git reset --hard --quiet "$target"

  # Only reinstall dependencies if the lockfile actually moved — saves a minute
  # or two per deploy in the common case.
  if ! git diff --quiet "$before" "$target" -- pnpm-lock.yaml; then
    pnpm install --frozen-lockfile
  fi
fi

after=$(git rev-parse HEAD)

# Reload in case ops/nag-expo.service changed — the unit file lives in the
# checkout (symlinked into ~/.config/systemd/user/), so a git reset can
# silently update it but systemd will keep serving the old copy until told.
systemctl --user daemon-reload

# Always restart on deploy — lets a re-run of the workflow recover a wedged
# service even when HEAD didn't move. Metro's file watcher would notice a
# reset anyway, but a clean restart avoids the thundering-herd of watcher
# events; the dev client reconnects automatically.
systemctl --user restart "$SERVICE"

printf 'nag: deployed %s -> %s\n' "$before" "$after"
