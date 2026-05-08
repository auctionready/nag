#!/usr/bin/env bash
# Build the Nag.Api Lambda zip end-to-end:
#
#   1. Ensure Amazon.Lambda.Tools is installed.
#   2. Pre-generate Wolverine handler types so the Lambda doesn't pay the
#      runtime code-gen cost on first invocation (issue #108).
#   3. Run `dotnet lambda package` to produce the deployable zip.
#
# This is the same set of steps the deploy workflow runs in CI, kept here so
# they can be reproduced locally and so the workflow has a single command to
# call.
#
# Usage:
#   ./scripts/package-lambda.sh                    # writes infra/artifacts/nag-api.zip
#   OUTPUT=/tmp/nag-api.zip ./scripts/package-lambda.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$BACKEND_DIR")"
OUTPUT="${OUTPUT:-$REPO_ROOT/infra/artifacts/nag-api.zip}"

# `dotnet tool install -g` fails if the tool is already present, so use
# update which installs-or-updates idempotently.
dotnet tool update -g Amazon.Lambda.Tools >/dev/null

cd "$BACKEND_DIR/Nag.Api"

# Wipe prior pre-generated handlers before regenerating: `codegen write`
# only adds/overwrites, it doesn't prune handlers for routes that were
# deleted or renamed. Without this, stale `Internal/Generated/*.cs`
# files referencing removed types (e.g. an endpoint that's been renamed)
# fail the Release compile below.
rm -rf Internal/Generated

# Skip NuGet restore so this script doesn't churn the local Debug build's
# package state. Callers (CI, dev) are responsible for `dotnet restore`
# beforehand — CI does it explicitly in the workflow.
#
# NAG_RUN_JASPERFX_COMMANDS gates Program.cs's JasperFx command path.
# Without it, `dotnet run -- codegen write` would still hit `app.Run()`.
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --no-restore --configuration Release -- codegen write

mkdir -p "$(dirname "$OUTPUT")"

# `dotnet lambda package` shells out to `dotnet publish`; `--msbuild-parameters
# --no-restore` forwards the flag through so publish skips its implicit restore.
dotnet lambda package \
  --configuration Release \
  --framework net10.0 \
  --function-architecture arm64 \
  --msbuild-parameters "--no-restore" \
  --output-package "$OUTPUT"

# Generated handlers are only used by the Lambda (TypeLoadMode.Static in
# Production). Leaving them in the tree means subsequent Debug builds
# compile stale handlers if routes are renamed/removed; wipe them so dev
# builds aren't poisoned by this script.
rm -rf Internal/Generated

echo "Wrote $OUTPUT"
