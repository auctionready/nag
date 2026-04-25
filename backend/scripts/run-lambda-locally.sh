#!/usr/bin/env bash
# Boot the API the same way Lambda does: pre-generated handler code +
# AutoCreate.None + ASPNETCORE_ENVIRONMENT=Production.
#
# Catches the things `dotnet run` / `dotnet test` can't:
#   - Missing pre-generated handler types (TypeLoadMode.Static throws on
#     first request otherwise).
#   - Schema gaps (AutoCreate.None won't paper over them).
#
# Requires a running Postgres with the `nag` database created; for first-
# time use, run `./scripts/setup-db.sh` then either an initial Development
# boot (so Marten can CreateOrUpdate the schema) or `resources setup`.
#
# Usage:
#   ./scripts/run-lambda-locally.sh
#
#   # If schema setup hasn't been run yet:
#   APPLY_SCHEMA=1 ./scripts/run-lambda-locally.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR/Nag.Api"

# 1. Pre-generate Wolverine handler types (same step as package-lambda.sh).
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release -- codegen write

if [ "${APPLY_SCHEMA:-}" = "1" ]; then
  # 2. Apply Marten schema up-front. Production has AutoCreate.None, so the
  # host won't migrate on its own.
  NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release --no-build -- resources setup
fi

# 3. Boot as production. Re-uses the build artifacts from step 1.
ASPNETCORE_ENVIRONMENT=Production dotnet run --configuration Release --no-build
