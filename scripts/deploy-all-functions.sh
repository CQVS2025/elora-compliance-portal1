#!/bin/bash

# Deploy all Supabase Edge Functions
# Usage: ./scripts/deploy-all-functions.sh

set -e

echo "🚀 Deploying all Supabase Edge Functions..."
echo ""

# Supabase project ref
PROJECT_REF="mtjfypwrtvzhnzgatoim"

# List of all functions
FUNCTIONS=(
  "checkNotifications"
  "createHeidelbergTestUser"
  "elora_customers"
  "elora_dashboard"
  "elora_delete_compliance_target"
  "elora_devices"
  "elora_get_compliance_targets"
  "elora_get_digest_preferences"
  "elora_get_favorites"
  "elora_recent_activity"
  "elora_refills"
  "elora_save_compliance_target"
  "elora_save_digest_preferences"
  "elora_scans"
  "elora_sites"
  "elora_test"
  "elora_test2"
  "elora_toggle_favorite"
  "elora_vehicles"
  "sendEmailReport"
  "sendScheduledReports"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying $func..."
  supabase functions deploy $func --project-ref $PROJECT_REF
  echo "✅ $func deployed"
  echo ""
done

echo "🎉 All functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Supabase dashboard"
echo "2. Test functions using the Supabase Functions editor"
echo "3. Run test-all.sh to verify functionality"
