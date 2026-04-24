#!/usr/bin/env bash
# Creates the 'nag' PostgreSQL database if it doesn't already exist.
# Marten handles all schema/table creation on first run.
#
# Usage:
#   ./scripts/setup-db.sh                          # localhost:5432, user=postgres
#   ./scripts/setup-db.sh -h myhost -p 5433 -U me  # custom connection
#
# Requires: psql (PostgreSQL client)

set -euo pipefail

DB_NAME="nag"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"

# Pass any extra args straight through to psql (e.g. -h myhost -p 5433 -U me)
PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@")

if psql "${PSQL_ARGS[@]}" -lqt | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  echo "Database '$DB_NAME' already exists — nothing to do."
else
  createdb "${PSQL_ARGS[@]}" "$DB_NAME"
  echo "Database '$DB_NAME' created."
fi
