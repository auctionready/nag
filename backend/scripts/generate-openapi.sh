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

# Build into an isolated artifacts path rather than the default Nag.Api/obj +
# Nag.Api/bin. Swashbuckle is a Debug-only PackageReference and OpenApi/*.cs is
# Compile-Removed outside Debug (see Nag.Api.csproj), so the restored
# project.assets.json differs by configuration. When turbo runs //#check:openapi
# (this script, Debug) concurrently with @nag/backend#build (Release), both
# dotnet invocations share Nag.Api/obj/project.assets.json — and if the Release
# restore wins, this Debug compile sees no Swashbuckle reference and fails with
# CS0246. A dedicated --artifacts-path makes this build hermetic.
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
dotnet build Nag.Api/Nag.Api.csproj -c Debug --artifacts-path "$BUILD_DIR" --nologo -v quiet

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
  "$BUILD_DIR/bin/Nag.Api/debug/Nag.Api.dll" \
  v1

echo "Wrote $OUTPUT"
