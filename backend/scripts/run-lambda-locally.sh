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

# Load env files so Production mode has the same config that Debug gets
# via dotenv.net. .env.local overrides .env.
# Uses a while-read loop instead of `source` because values can contain
# semicolons (e.g. Postgres connection strings) that bash would interpret.
load_env() {
  local file="$1"
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip blanks and comments.
    [[ -z "$line" || "$line" == \#* ]] && continue
    export "$line"
  done < "$file"
}
[ -f .env ] && load_env .env
[ -f .env.local ] && load_env .env.local

# 1. Pre-generate Wolverine handler types (same step as package-lambda.sh).
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release --no-launch-profile -- codegen write

if [ "${APPLY_SCHEMA:-}" = "1" ]; then
  # 2. Apply Marten schema up-front. Production has AutoCreate.None, so the
  # host won't migrate on its own.
  NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release --no-build --no-launch-profile -- resources setup
fi

# 3. Boot as production on the same port as Development (launchSettings).
ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5266 \
  dotnet run --configuration Release --no-build --no-launch-profile
