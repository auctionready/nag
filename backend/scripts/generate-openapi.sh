#!/usr/bin/env bash
# Generate openapi.json statically from the compiled Nag.Api assembly.
#
# Uses the Swashbuckle.AspNetCore.Cli dotnet tool (`dotnet swagger tofile`),
# which loads the built DLL, asks the in-process ISwaggerProvider for the
# `v1` document, writes it to disk, and exits — no Kestrel bind, no
# `dotnet run`, no real database.
#
# The generated file is consumed by packages/api-client to regenerate the
# typed Zodios client.
#
# Usage:
#   ./scripts/generate-openapi.sh              # writes packages/api-client/openapi.json
#   OUTPUT=/tmp/spec.json ./scripts/generate-openapi.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$BACKEND_DIR")"
OUTPUT="${OUTPUT:-$REPO_ROOT/packages/api-client/openapi.json}"

cd "$BACKEND_DIR"

# Custom Swashbuckle filters (CommandSchemasFilter, EnumSchemaFilter) are
# wrapped in `#if DEBUG`, so generation only works against a Debug build.
dotnet tool restore
dotnet build Nag.Api/Nag.Api.csproj -c Debug --nologo -v quiet

# Throwaway config so Program.Main can construct the host. Marten validates
# the DSN format but doesn't open a connection during host build, and the
# Swashbuckle CLI never reaches a request, so no real database is needed.
export ConnectionStrings__Nag="Host=localhost;Database=nag;Username=nag;Password=nag"
export ASPNETCORE_ENVIRONMENT=Development
unset Nag__ClerkIssuer  # keep the Clerk/JWT branch in Program.cs disabled

mkdir -p "$(dirname "$OUTPUT")"

dotnet swagger tofile \
  --output "$OUTPUT" \
  Nag.Api/bin/Debug/net10.0/Nag.Api.dll \
  v1

echo "Wrote $OUTPUT"
