#!/usr/bin/env bash
# Drops every Marten/Wolverine table and document so the database is empty
# at the end. Useful when iterating on event-store / projection schema
# changes (this branch's `ProcessedCommand` → `ProcessedEnvelope` rename,
# the outbox shape flip, etc.) where Marten would otherwise replay
# stale streams or keep orphaned tables around.
#
# Strategy: drop and recreate the `public` schema, then drop any
# additional schemas Marten created (the test suite uses `api_*` /
# `proj_*` per-class schemas; production uses just `public`). Net
# result: a fresh database with zero tables, zero rows.
#
# Usage:
#   ./scripts/clear-db.sh --local          # localhost, db=nag, user=nag
#   ./scripts/clear-db.sh --neon           # uses DB_HOST / DB_NAME /
#                                          # DB_USERNAME / DB_PASSWORD
#                                          # with sslmode=require
#
# The script asks for confirmation before running. Pass `--yes` to skip
# the prompt (e.g. for CI / scripted teardown).

set -euo pipefail

mode=""
assume_yes=0
for arg in "$@"; do
  case "$arg" in
    --local) mode="local" ;;
    --neon)  mode="neon" ;;
    --yes|-y) assume_yes=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$mode" ]]; then
  echo "usage: $0 --local|--neon [--yes]" >&2
  exit 2
fi

if [[ "$mode" == "local" ]]; then
  : "${PGHOST:=localhost}"
  : "${PGPORT:=5432}"
  : "${PGUSER:=nag}"
  : "${PGPASSWORD:=nag}"
  : "${PGDATABASE:=nag}"
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
  target="postgres://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
  sslmode=""
else
  : "${DB_HOST:?DB_HOST is required for --neon}"
  : "${DB_PASSWORD:?DB_PASSWORD is required for --neon}"
  : "${DB_NAME:=nag}"
  : "${DB_USERNAME:=nag}"
  export PGHOST="$DB_HOST"
  export PGUSER="$DB_USERNAME"
  export PGPASSWORD="$DB_PASSWORD"
  export PGDATABASE="$DB_NAME"
  export PGPORT="${DB_PORT:-5432}"
  export PGSSLMODE="require"
  target="postgres://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
  sslmode=" (sslmode=require)"
fi

echo "Target: $target$sslmode"
if [[ "$assume_yes" -ne 1 ]]; then
  read -r -p "Drop everything in $PGDATABASE? Type 'yes' to confirm: " reply
  if [[ "$reply" != "yes" ]]; then
    echo "aborted"
    exit 1
  fi
fi

# Drop and recreate the public schema, then cascade-drop every other
# user schema Marten / the test suite may have created. The DO block
# loops over information_schema rather than hard-coding names so
# api_* / proj_* test schemas (left over from `dotnet test` runs)
# get cleaned up too.
psql -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

DO $$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT schema_name
        FROM information_schema.schemata
       WHERE schema_name NOT IN ('public', 'information_schema', 'pg_catalog', 'pg_toast')
         AND schema_name NOT LIKE 'pg_%'
    LOOP
      EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
    END LOOP;
  END
$$;

\echo Remaining user objects:
SELECT n.nspname AS schema, c.relname AS object, c.relkind AS kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
   AND n.nspname NOT LIKE 'pg_%'
 ORDER BY 1, 2;
SQL

echo "Done. Database '$PGDATABASE' is now empty."
