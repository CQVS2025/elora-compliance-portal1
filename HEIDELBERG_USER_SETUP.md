# Heidelberg Materials User Setup Guide

## Login Credentials
| Field | Value |
|-------|-------|
| **Email** | jonny.harper01@gmail.com |
| **Password** | jonnyharper5 |

## Branding
| Property | Value |
|----------|-------|
| Company | Heidelberg Materials |
| Primary Color | #003DA5 (Heidelberg Blue) |
| Secondary Color | #00A3E0 (Light Blue) |
| Tagline | "Building Tomorrow's Infrastructure Today" |

---

## Setup Instructions

### Step 1: Run the Database Migration

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/sql/new)
2. Copy and paste the contents of:
   ```
   supabase/migrations/20250116000001_heidelberg_complete_setup.sql
   ```
3. Click **Run** to execute

This creates:
- Heidelberg Materials company
- Full branding configuration (login, email, PDF styles)
- User permissions for the demo user
- Sample compliance targets

### Step 2: Create the Auth User

1. Go to [Supabase Authentication](https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/auth/users)
2. Click **Add user** → **Create new user**
3. Enter:
   - Email: `jonny.harper01@gmail.com`
   - Password: `jonnyharper5`
   - Check **Auto Confirm User**
4. Click **Create user**

### Step 3: Create the User Profile

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/sql/new)
2. Run the following SQL:

```sql
INSERT INTO user_profiles (id, company_id, email, full_name, phone, job_title, role, company_name, is_active)
SELECT
    au.id,
    c.id,
    'jonny.harper01@gmail.com',
    'Jonny Harper',
    '+61 400 000 000',
    'Fleet Manager',
    'admin',
    'Heidelberg Materials',
    true
FROM auth.users au
CROSS JOIN companies c
WHERE au.email = 'jonny.harper01@gmail.com'
AND c.email_domain = 'heidelberg.com.au'
ON CONFLICT (email) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    full_name = 'Jonny Harper',
    role = 'admin',
    company_name = 'Heidelberg Materials',
    updated_at = NOW();
```

---

## Verification

### Test Login
1. Go to your portal URL (e.g., http://localhost:5173 or deployed URL)
2. Login with:
   - Email: `jonny.harper01@gmail.com`
   - Password: `jonnyharper5`
3. You should see:
   - Heidelberg Materials logo
   - Blue gradient theme (#003DA5 → #00A3E0)
   - "Building Tomorrow's Infrastructure Today" tagline
   - Full dashboard access

### Verify in Database
Run this SQL to confirm setup:

```sql
SELECT
    up.email,
    up.full_name,
    up.role,
    c.name as company,
    cb.primary_color,
    cb.login_tagline
FROM user_profiles up
JOIN companies c ON up.company_id = c.id
LEFT JOIN client_branding cb ON c.id = cb.company_id
WHERE up.email = 'jonny.harper01@gmail.com';
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Supabase Project | mtjfypwrtvzhnzgatoim |
| Company Email Domain | heidelberg.com.au |
| User Role | admin |
| Has Full Access | Yes |

## What You'll See

- **Login Page**: Blue gradient background with Heidelberg Materials logo
- **Dashboard**: Full compliance analytics and reporting
- **Reports**: PDF reports with Heidelberg branding
- **Emails**: Branded email templates with company colors
