#!/usr/bin/env bash
# Apply Marten/Wolverine schema changes to a Postgres database.
#
# Production sets `AutoCreateSchemaObjects = AutoCreate.None` so the Lambda
# does not introspect pg_catalog on every cold start. Schema changes
# therefore have to be applied out-of-band — this script is what does it.
#
# Reads `DATABASE_URL` (the Neon `connection_uri`, same env var the Lambda
# uses — see `Nag.Api/Infrastructure/LambdaSecrets.cs`). Run this once per
# deploy after the DB exists and the application binaries are built.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host/db?sslmode=require \
#   ./scripts/apply-db-migrations.sh

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR/Nag.Api"

# Production-style configuration: matches the Lambda's Marten setup so
# `db-apply` plans the same schema (e.g. AutoCreate.None doesn't matter
# here; db-apply applies pending changes regardless).
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Production}"
export DATABASE_URL

# NAG_RUN_JASPERFX_COMMANDS gates the JasperFx CLI path in Program.cs.
# `db-apply` is registered by Marten/Wolverine and applies any pending
# schema changes (idempotent — safe to run on every deploy).
NAG_RUN_JASPERFX_COMMANDS=1 dotnet run --configuration Release -- db-apply
