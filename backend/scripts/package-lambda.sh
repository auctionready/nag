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

# NAG_RUN_JASPERFX_COMMANDS gates Program.cs's JasperFx command path.
# Without it, `dotnet run -- codegen write` would still hit `app.Run()`.
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release -- codegen write

mkdir -p "$(dirname "$OUTPUT")"

dotnet lambda package \
  --configuration Release \
  --framework net10.0 \
  --function-architecture arm64 \
  --output-package "$OUTPUT"

echo "Wrote $OUTPUT"
