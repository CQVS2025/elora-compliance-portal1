#!/bin/bash
# Test Supabase Edge Functions
# This script tests each Elora API edge function to ensure they're working

set -e  # Exit on error

PROJECT_REF="mtjfypwrtvzhnzgatoim"
SUPABASE_URL="https://mtjfypwrtvzhnzgatoim.supabase.co"
# Get anon key from .env.local
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2)

if [ -z "$ANON_KEY" ]; then
  echo "❌ ERROR: Could not find VITE_SUPABASE_ANON_KEY in .env.local"
  exit 1
fi

echo "🧪 Testing Supabase Edge Functions"
echo "===================================="
echo ""
echo "Project: $PROJECT_REF"
echo "URL: $SUPABASE_URL"
echo ""

test_function() {
  local func_name=$1
  local test_body=$2

  echo "Testing $func_name..."

  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    "$SUPABASE_URL/functions/v1/$func_name" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$test_body")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 200 ]; then
    echo "  ✅ $func_name returned 200 OK"
    echo "  Response: ${body:0:100}..."
  else
    echo "  ❌ $func_name returned $http_code"
    echo "  Response: $body"
  fi
  echo ""
}

# Test each function
echo "📡 Testing Elora API Functions:"
echo ""

test_function "elora_customers" '{}'
test_function "elora_sites" '{}'
test_function "elora_vehicles" '{"customer_id":"all","site_id":"all"}'
test_function "elora_devices" '{"status":"active"}'
test_function "elora_dashboard" '{"customer_id":"all","site_id":"all"}'
test_function "elora_refills" '{"fromDate":"2024-01-01","toDate":"2024-12-31"}'
test_function "elora_scans" '{"customer_id":"all","site_id":"all"}'

echo "===================================="
echo "✨ Testing complete!"
echo ""
echo "If any tests failed:"
echo "1. Check that secrets are set: supabase secrets list --project-ref $PROJECT_REF"
echo "2. Check function logs: supabase functions logs <function-name> --project-ref $PROJECT_REF"
echo "3. Verify ELORA_API_KEY is correct"
