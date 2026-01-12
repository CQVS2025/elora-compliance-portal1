#!/bin/bash
# Verify local development environment setup

echo "🔍 Verifying Local Development Setup"
echo "====================================="
echo ""

errors=0

# Check for .env.local
echo "Checking .env.local file..."
if [ -f ".env.local" ]; then
  echo "  ✅ .env.local exists"

  # Check for required variables
  if grep -q "VITE_SUPABASE_URL" .env.local; then
    echo "  ✅ VITE_SUPABASE_URL is set"
  else
    echo "  ❌ VITE_SUPABASE_URL is missing"
    errors=$((errors + 1))
  fi

  if grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
    echo "  ✅ VITE_SUPABASE_ANON_KEY is set"
  else
    echo "  ❌ VITE_SUPABASE_ANON_KEY is missing"
    errors=$((errors + 1))
  fi
else
  echo "  ❌ .env.local not found"
  echo "     Copy .env.example to .env.local and fill in your values"
  errors=$((errors + 1))
fi

echo ""

# Check for node_modules
echo "Checking node_modules..."
if [ -d "node_modules" ]; then
  echo "  ✅ node_modules exists"
else
  echo "  ❌ node_modules not found"
  echo "     Run: npm install"
  errors=$((errors + 1))
fi

echo ""

# Check for Supabase CLI
echo "Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
  version=$(supabase --version)
  echo "  ✅ Supabase CLI installed: $version"
else
  echo "  ❌ Supabase CLI not found"
  echo "     Install: npm install -g supabase"
  errors=$((errors + 1))
fi

echo ""

# Check edge functions
echo "Checking Edge Functions..."
required_functions=(
  "elora_customers"
  "elora_dashboard"
  "elora_devices"
  "elora_refills"
  "elora_scans"
  "elora_sites"
  "elora_vehicles"
)

for func in "${required_functions[@]}"; do
  if [ -d "supabase/functions/$func" ]; then
    echo "  ✅ $func exists"
  else
    echo "  ❌ $func missing"
    errors=$((errors + 1))
  fi
done

echo ""
echo "====================================="
if [ $errors -eq 0 ]; then
  echo "✨ All checks passed! Your setup is ready."
  echo ""
  echo "Next steps:"
  echo "1. Run: npm run dev (to start local development)"
  echo "2. Run: ./scripts/set-secrets.sh (to configure Supabase secrets)"
  echo "3. Run: ./scripts/deploy-functions.sh (to deploy to production)"
else
  echo "❌ Found $errors error(s). Please fix the issues above."
  exit 1
fi
