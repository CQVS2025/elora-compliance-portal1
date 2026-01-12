#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export it before running this script." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools before running this script." >&2
  exit 1
fi

echo "Applying migrations using DATABASE_URL..."
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/migrations/20250112000001_initial_schema.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/migrations/20250112000002_rls_policies.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/migrations/20250112000003_seed_test_data.sql

echo "Done. Check the Supabase dashboard for tables and seed data."
