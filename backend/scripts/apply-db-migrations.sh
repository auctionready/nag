#!/usr/bin/env bash
# Apply Marten/Wolverine schema changes to a Postgres database.
#
# Production sets `AutoCreateSchemaObjects = AutoCreate.None` so the Lambda
# does not introspect pg_catalog on every cold start. Schema changes
# therefore have to be applied out-of-band — this script is what does it.
#
# Reads the same DB_* environment variables the Lambda uses (see
# `Nag.Api/Infrastructure/LambdaSecrets.cs`). Run this once per deploy
# after the DB exists and the application binaries are built.
#
# Usage:
#   DB_HOST=ep-xxx.aws.neon.tech \
#   DB_NAME=nag \
#   DB_USERNAME=nag \
#   DB_PASSWORD=... \
#   ./scripts/apply-db-migrations.sh

set -euo pipefail

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:=nag}"
: "${DB_USERNAME:=nag}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR/Nag.Api"

# Production-style configuration: matches the Lambda's Marten setup so
# `db-apply` plans the same schema (e.g. AutoCreate.None doesn't matter
# here; db-apply applies pending changes regardless).
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Production}"
export DB_HOST DB_NAME DB_USERNAME DB_PASSWORD

# NAG_RUN_JASPERFX_COMMANDS gates the JasperFx CLI path in Program.cs.
# `db-apply` is registered by Marten/Wolverine and applies any pending
# schema changes (idempotent — safe to run on every deploy).
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release -- db-apply
