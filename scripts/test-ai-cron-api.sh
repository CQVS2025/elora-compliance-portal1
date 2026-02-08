#!/bin/bash
# Test AI Insights Cron API Endpoint (Node.js version)
#
# Usage:
#   CRON_SECRET=your_secret ./scripts/test-ai-cron-api.sh
#   APP_URL=https://your-app.vercel.app CRON_SECRET=your_secret ./scripts/test-ai-cron-api.sh

set -e

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET is required."
  echo ""
  echo "Usage:"
  echo "  CRON_SECRET=your_secret ./scripts/test-ai-cron-api.sh"
  echo ""
  echo "Or specify custom URL:"
  echo "  APP_URL=https://your-app.vercel.app CRON_SECRET=your_secret ./scripts/test-ai-cron-api.sh"
  exit 1
fi

echo "Invoking AI Insights Cron API..."
echo "URL: $APP_URL/api/cron/ai-insights"
echo ""

START=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/cron/ai-insights" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d "{}" \
  --max-time 1800)
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
