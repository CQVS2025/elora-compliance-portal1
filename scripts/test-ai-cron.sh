#!/bin/bash
# Test run-ai-cron Edge Function (manual trigger, same as cron job)
#
# Auth option 1 (recommended): CRON_SECRET - set in Edge Function secrets, then:
#   CRON_SECRET=your_secret ./scripts/test-ai-cron.sh
#
# Auth option 2: SUPABASE_SERVICE_ROLE_KEY - from Project Settings -> API -> service_role:
#   SUPABASE_SERVICE_ROLE_KEY=your_key ./scripts/test-ai-cron.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-https://mtjfypwrtvzhnzgatoim.supabase.co}"
CRON_SECRET="${CRON_SECRET:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# Build headers: prefer CRON_SECRET (x-cron-secret), fallback to Authorization Bearer
EXTRA_HEADERS=()
if [ -n "$CRON_SECRET" ]; then
  EXTRA_HEADERS+=(-H "x-cron-secret: $CRON_SECRET")
elif [ -n "$SERVICE_KEY" ]; then
  EXTRA_HEADERS+=(-H "Authorization: Bearer $SERVICE_KEY")
else
  echo "Error: Either CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY is required."
  echo ""
  echo "Option 1 - CRON_SECRET (recommended): Add CRON_SECRET to Edge Function secrets, then:"
  echo "  CRON_SECRET=your_secret ./scripts/test-ai-cron.sh"
  echo ""
  echo "Option 2 - Service role key: Project Settings -> API -> service_role (secret):"
  echo "  SUPABASE_SERVICE_ROLE_KEY=your_key ./scripts/test-ai-cron.sh"
  exit 1
fi

echo "Invoking run-ai-cron..."
echo "URL: $SUPABASE_URL/functions/v1/run-ai-cron"
echo ""

START=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SUPABASE_URL/functions/v1/run-ai-cron" \
  -H "Content-Type: application/json" \
  "${EXTRA_HEADERS[@]}" \
  -d "{}" \
  --max-time 120)
END=$(date +%s)
DURATION=$((END - START))

HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "HTTP Status: $HTTP_CODE"
echo "Duration: ${DURATION}s"
echo ""
echo "Response:"
if command -v jq &>/dev/null; then
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
else
  echo "$HTTP_BODY"
fi
echo ""

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Result: SUCCESS"
  exit 0
else
  echo "Result: FAILED (HTTP $HTTP_CODE)"
  exit 1
fi
