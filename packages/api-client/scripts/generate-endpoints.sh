#!/usr/bin/env bash -e

URL="${OPENAPI_URL:-http://localhost:5266/swagger/v1/swagger.json}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT="$PKG_DIR/src/endpoint-definition.ts"
TEMPLATE="$SCRIPT_DIR/endpoint-template.hbs"

echo "Generating from $URL"
pnpx openapi-zod-client "$URL" \
  -o "$OUTPUT" \
  --template "$TEMPLATE" \
  --with-alias \
  --export-schemas \
  --prettier "$PKG_DIR/../../.prettierrc"

sed -i '' -E \
  -e 's/z\.string\(\)\.uuid\(\)/z.uuid()/g' \
  -e 's/z\.number\(\)\.int\(\)/z.int()/g' \
  -e 's/z\.string\(\)\.datetime\(([^)]*)\)/z.iso.datetime(\1).transform((s) => new Date(s))/g' \
  -e 's/z\.string\(\)\.date\(\)/z.iso.date().transform((s) => new Date(s))/g' \
  "$OUTPUT"

echo "Done."
