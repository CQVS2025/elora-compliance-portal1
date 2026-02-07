#!/bin/bash
# Deploy all Supabase Edge Functions to production
# Run this script after making changes to any edge functions

set -e  # Exit on error

PROJECT_REF="mtjfypwrtvzhnzgatoim"

echo "🚀 Deploying Supabase Edge Functions to project: $PROJECT_REF"
echo "=================================================="
echo ""

# Array of all Elora API edge functions that need to be deployed
FUNCTIONS=(
  "elora_customers"
  "elora_dashboard"
  "elora_devices"
  "elora_refills"
  "elora_scans"
  "elora_sites"
  "elora_vehicles"
)

# AI Insights functions
AI_FUNCTIONS=(
  "analyze-fleet"
  "analyze-vehicle-risk-batch"
  "generate-wash-recommendations"
  "run-ai-cron"
)

# Additional utility functions
UTIL_FUNCTIONS=(
  "elora_recent_activity"
  "elora_get_favorites"
  "elora_toggle_favorite"
  "elora_get_compliance_targets"
  "elora_save_compliance_target"
  "elora_delete_compliance_target"
  "elora_get_digest_preferences"
  "elora_save_digest_preferences"
  "elora_get_permissions"
  "elora_save_permissions"
  "checkNotifications"
  "sendEmailReport"
  "sendScheduledReports"
)

# Deploy all Elora API functions
echo "📦 Deploying core Elora API functions..."
for func in "${FUNCTIONS[@]}"; do
  echo "  → Deploying $func..."
  supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt
  if [ $? -eq 0 ]; then
    echo "    ✅ $func deployed successfully"
  else
    echo "    ❌ Failed to deploy $func"
    exit 1
  fi
done

echo ""
echo "📦 Deploying AI Insights functions..."
for func in "${AI_FUNCTIONS[@]}"; do
  echo "  → Deploying $func..."
  supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt
  if [ $? -eq 0 ]; then
    echo "    ✅ $func deployed successfully"
  else
    echo "    ❌ Failed to deploy $func"
    exit 1
  fi
done

echo ""
echo "📦 Deploying utility functions..."
for func in "${UTIL_FUNCTIONS[@]}"; do
  echo "  → Deploying $func..."
  supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt
  if [ $? -eq 0 ]; then
    echo "    ✅ $func deployed successfully"
  else
    echo "    ❌ Failed to deploy $func"
    exit 1
  fi
done

echo ""
echo "=================================================="
echo "✨ All functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify ELORA_API_KEY secret is set: ./scripts/set-secrets.sh"
echo "2. Test the APIs: ./scripts/test-apis.sh"
echo "3. Deploy to Vercel (see VERCEL_DEPLOYMENT.md)"
