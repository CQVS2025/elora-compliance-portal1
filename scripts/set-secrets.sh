#!/bin/bash
# Set Supabase Edge Function secrets
# This configures the ELORA_API_KEY that edge functions need to call the Elora API

set -e  # Exit on error

PROJECT_REF="mtjfypwrtvzhnzgatoim"
ELORA_API_KEY="TYjmdhZvL9dHZIT6O2DXVkfg9LZSv7X9"

echo "🔐 Setting Supabase Edge Function Secrets"
echo "=========================================="
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Set the ELORA_API_KEY secret
echo "Setting ELORA_API_KEY..."
supabase secrets set ELORA_API_KEY="$ELORA_API_KEY" --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
  echo "✅ ELORA_API_KEY secret set successfully"
else
  echo "❌ Failed to set ELORA_API_KEY secret"
  exit 1
fi

echo ""
echo "=========================================="
echo "✨ All secrets configured!"
echo ""
echo "To verify secrets are set:"
echo "  supabase secrets list --project-ref $PROJECT_REF"
echo ""
echo "Next steps:"
echo "1. Deploy functions: ./scripts/deploy-functions.sh"
echo "2. Test the APIs: ./scripts/test-apis.sh"
