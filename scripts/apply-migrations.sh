#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="mtjfypwrtvzhnzgatoim"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it with: npm install -g supabase" >&2
  exit 1
fi

echo "Linking Supabase project (${PROJECT_REF})..."
supabase link --project-ref "${PROJECT_REF}"

echo "Pushing database migrations..."
supabase db push

echo "Done. Check the Supabase dashboard for tables and seed data."
