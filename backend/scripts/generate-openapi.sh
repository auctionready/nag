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
OUTPUT="${OUTPUT:-$BACKEND_DIR/Nag.Api/OpenApi/openapi.json}"

cd "$BACKEND_DIR"

# Custom Swashbuckle filters (CommandSchemasFilter, EnumSchemaFilter) are
# wrapped in `#if DEBUG`, so generation only works against a Debug build.
dotnet tool restore
# Force a Debug-config restore so Swashbuckle (Debug-only PackageReference) is
# resolved even when a prior Release build left obj/project.assets.json
# pointing at the Release dependency set.
dotnet restore Nag.Api/Nag.Api.csproj -p:Configuration=Debug
dotnet build Nag.Api/Nag.Api.csproj -c Debug --no-restore --nologo -v quiet

# Throwaway config so Program.Main can construct the host. Marten validates
# the DSN format but doesn't open a connection during host build, and the
# Swashbuckle CLI never reaches a request, so no real database is needed.
export ConnectionStrings__Nag="Host=localhost;Database=nag;Username=nag;Password=nag"
export Nag__ApiKey="swagger-cli-throwaway"  # BearerKeyMiddleware throws if empty
# Dummy issuer registers IClerkTokenVerifier so AccountsEndpoints / DevicesEndpoints
# can resolve their `verifier` parameter. The OpenID metadata fetch is lazy
# (only happens on a real request), so no network call is made during spec generation.
export Nag__ClerkIssuer="https://example.invalid"
export ASPNETCORE_ENVIRONMENT=Development

mkdir -p "$(dirname "$OUTPUT")"

dotnet swagger tofile \
  --output "$OUTPUT" \
  Nag.Api/bin/Debug/net10.0/Nag.Api.dll \
  v1

echo "Wrote $OUTPUT"
