# Heidelberg Materials User Setup Guide

## User Details
- **Email:** jonny.harper01@gmail.com
- **Password:** jonnyharper5
- **Name:** Jonny Harper
- **Role:** Admin
- **Company:** Heidelberg Materials

## Branding Colors
- **Primary:** #003DA5 (Heidelberg Blue)
- **Secondary:** #00A3E0 (Light Blue)
- **Tagline:** "Building Tomorrow's Infrastructure Today"

---

## Setup Steps

### Step 1: Run the Migration

Go to your Supabase Dashboard:
1. Open https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query and paste the contents of:
   `supabase/migrations/20250115000001_heidelberg_full_branding.sql`
4. Click **Run** to execute

This sets up:
- Full Heidelberg Materials branding (login, email, PDF)
- User permissions for jonny.harper01@gmail.com
- Company settings

### Step 2: Deploy the Edge Function

**Option A: Via Supabase CLI (if installed locally)**
```bash
supabase functions deploy createHeidelbergUser --project-ref mtjfypwrtvzhnzgatoim
```

**Option B: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/functions
2. Click **New Function**
3. Name it: `createHeidelbergUser`
4. Paste the code from: `supabase/functions/createHeidelbergUser/index.ts`
5. Deploy

### Step 3: Create the User

**Option A: Via curl**
```bash
curl -X POST 'https://mtjfypwrtvzhnzgatoim.supabase.co/functions/v1/createHeidelbergUser' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "jonny.harper01@gmail.com",
    "password": "jonnyharper5",
    "full_name": "Jonny Harper",
    "job_title": "Fleet Manager",
    "role": "admin"
  }'
```

**Option B: Via Supabase Dashboard (Direct Auth User Creation)**
1. Go to https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/auth/users
2. Click **Add user** → **Create new user**
3. Enter:
   - Email: `jonny.harper01@gmail.com`
   - Password: `jonnyharper5`
   - Check "Auto Confirm User"
4. Click **Create user**

Then run this SQL in the SQL Editor to create the profile:
```sql
INSERT INTO user_profiles (
    id,
    company_id,
    email,
    full_name,
    phone,
    job_title,
    role,
    company_name,
    is_active
)
SELECT
    id,
    'hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid,
    'jonny.harper01@gmail.com',
    'Jonny Harper',
    '',
    'Fleet Manager',
    'admin',
    'Heidelberg Materials',
    true
FROM auth.users
WHERE email = 'jonny.harper01@gmail.com'
ON CONFLICT (email) DO UPDATE SET
    full_name = 'Jonny Harper',
    role = 'admin',
    company_name = 'Heidelberg Materials',
    updated_at = NOW();
```

---

## Verification

After setup, verify by logging in:
1. Go to your portal URL
2. Login with:
   - Email: `jonny.harper01@gmail.com`
   - Password: `jonnyharper5`
3. You should see Heidelberg Materials branding (blue theme)

---

## Quick Reference

| Item | Value |
|------|-------|
| Project Ref | mtjfypwrtvzhnzgatoim |
| Company ID | hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8 |
| Email Domain | heidelberg.com.au |
| Primary Color | #003DA5 |
| Secondary Color | #00A3E0 |
