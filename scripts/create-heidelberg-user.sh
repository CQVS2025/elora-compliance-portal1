#!/bin/bash

# Create Heidelberg Materials User
# This script calls the createHeidelbergUser edge function to create a user
# with full Heidelberg Materials branding and permissions

set -e

# Configuration
PROJECT_REF="mtjfypwrtvzhnzgatoim"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/createHeidelbergUser"

# User details - Jonny Harper
USER_EMAIL="jonny.harper01@gmail.com"
USER_PASSWORD="jonnyharper5"
USER_FULL_NAME="Jonny Harper"
USER_PHONE=""
USER_JOB_TITLE="Fleet Manager"
USER_ROLE="admin"

echo "=========================================="
echo "Heidelberg Materials User Creation"
echo "=========================================="
echo ""
echo "Creating user with the following details:"
echo "  Email:    ${USER_EMAIL}"
echo "  Name:     ${USER_FULL_NAME}"
echo "  Role:     ${USER_ROLE}"
echo "  Company:  Heidelberg Materials"
echo ""

# Get ANON_KEY from environment or prompt
if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Please set SUPABASE_ANON_KEY environment variable"
  echo "Export it like: export SUPABASE_ANON_KEY='your-anon-key'"
  exit 1
fi

# Call the edge function
echo "Calling createHeidelbergUser function..."
echo ""

RESPONSE=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${USER_EMAIL}\",
    \"password\": \"${USER_PASSWORD}\",
    \"full_name\": \"${USER_FULL_NAME}\",
    \"phone\": \"${USER_PHONE}\",
    \"job_title\": \"${USER_JOB_TITLE}\",
    \"role\": \"${USER_ROLE}\"
  }")

echo "Response:"
echo "$RESPONSE" | jq .

echo ""
echo "=========================================="
echo "User Creation Complete!"
echo "=========================================="
echo ""
echo "Login credentials:"
echo "  Portal URL: https://${PROJECT_REF}.supabase.co (or your custom domain)"
echo "  Email:      ${USER_EMAIL}"
echo "  Password:   ${USER_PASSWORD}"
echo ""
echo "Heidelberg Materials Branding:"
echo "  Primary Color:   #003DA5 (Heidelberg Blue)"
echo "  Secondary Color: #00A3E0 (Light Blue)"
echo "  Tagline:         Building Tomorrow's Infrastructure Today"
echo ""
