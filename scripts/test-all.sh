#!/bin/bash

# Test all Supabase Edge Functions
# Usage: ./scripts/test-all.sh

set -e

echo "🧪 Testing Supabase Edge Functions..."
echo ""

PROJECT_REF="mtjfypwrtvzhnzgatoim"
SUPABASE_URL="https://mtjfypwrtvzhnzgatoim.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10amZ5cHdydHZ6aG56Z2F0b2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDg4NjksImV4cCI6MjA4MzcyNDg2OX0.6bLX8uIVCYNKwwRDooVWbVuMVZ6-DMMzCnqVK_iK910"

# Test a simple function
echo "Testing elora_customers function..."
curl -L -X POST "${SUPABASE_URL}/functions/v1/elora_customers" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  | jq '.'

echo ""
echo "✅ Test complete!"
echo ""
echo "To test other functions, use:"
echo "curl -L -X POST \"\${SUPABASE_URL}/functions/v1/FUNCTION_NAME\" \\"
echo "  -H \"Authorization: Bearer \${ANON_KEY}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"param\": \"value\"}'"
