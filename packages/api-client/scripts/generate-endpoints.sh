#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"
DEFAULT_INPUT="$REPO_ROOT/backend/Nag.Api/OpenApi/openapi.json"
URL="${OPENAPI_URL:-$DEFAULT_INPUT}"
OUTPUT="$PKG_DIR/src/endpoint-definition.ts"
TEMPLATE="$SCRIPT_DIR/endpoint-template.hbs"

echo "Generating from $URL"
# Use `pnpm exec` (not `pnpx`/`pnpm dlx`) so the pinned devDependency
# version is used. `pnpm dlx` resolves from the registry on each run,
# which can produce drift between local generation and CI when a new
# version of openapi-zod-client is published.
pnpm exec openapi-zod-client "$URL" \
  -o "$OUTPUT" \
  --template "$TEMPLATE" \
  --with-alias \
  --export-schemas \
  --prettier "$PKG_DIR/../../.prettierrc"

# `sed -i` takes a different argument shape on BSD (macOS) vs GNU (Linux/CI):
# BSD requires a backup-suffix argument, GNU treats one as a literal suffix.
# Use a `.bak` suffix on both and clean it up afterwards.
sed -i.bak -E \
  -e 's/z\.string\(\)\.uuid\(\)/z.uuid()/g' \
  -e 's/z\.number\(\)\.int\(\)/z.int()/g' \
  -e 's/z\.record\(z\./z.record(z.string(), z./g' \
  -e 's/z\.string\(\)\.datetime\([^)]*\)/IsoDatetime/g' \
  -e 's/z\.string\(\)\.date\(\)/IsoDatetime/g' \
  -e 's/z\.record\(z\.array\(z\.string\(\)\)\)/z.record(z.string(), z.array(z.string()))/g' \
  "$OUTPUT"
rm -f "$OUTPUT.bak"

# openapi-zod-client bundles its own prettier; re-format with the repo's
# pinned prettier so output matches what lefthook/`pnpm format` produce.
pnpm exec prettier --write "$OUTPUT"

echo "Done."
