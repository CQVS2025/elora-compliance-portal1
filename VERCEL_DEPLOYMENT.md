# 🚀 Vercel Deployment Guide

Complete guide to deploy the Elora Compliance Portal to production on Vercel.

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Supabase CLI installed (`npm install -g supabase`)
- ✅ Vercel account with access to the project
- ✅ Git access to this repository
- ✅ Elora API credentials

## 🔧 Setup Steps

### Step 1: Configure Supabase Secrets

The Elora API key must be configured as a Supabase secret (NOT in your code or .env files).

```bash
# Set the ELORA_API_KEY secret in Supabase
./scripts/set-secrets.sh
```

Or manually:
```bash
supabase secrets set ELORA_API_KEY=TYjmdhZvL9dHZIT6O2DXVkfg9LZSv7X9 --project-ref mtjfypwrtvzhnzgatoim
```

Verify the secret is set:
```bash
supabase secrets list --project-ref mtjfypwrtvzhnzgatoim
```

### Step 2: Deploy Supabase Edge Functions

Deploy all 7 Elora API edge functions plus utility functions:

```bash
./scripts/deploy-functions.sh
```

Or deploy manually:
```bash
supabase functions deploy elora_customers --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_dashboard --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_devices --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_refills --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_scans --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_sites --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
supabase functions deploy elora_vehicles --project-ref mtjfypwrtvzhnzgatoim --no-verify-jwt
```

### Step 3: Test Edge Functions

Verify all edge functions are working:

```bash
./scripts/test-apis.sh
```

This will test all 7 Elora API endpoints and show you the responses.

### Step 4: Configure Vercel Environment Variables

Go to your Vercel project settings and add these environment variables:

**Required Variables:**

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://mtjfypwrtvzhnzgatoim.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anon/public key |

**How to add in Vercel:**

1. Go to https://vercel.com/your-team/elora-compliance-portal/settings/environment-variables
2. Click "Add New"
3. Enter the variable name
4. Paste the value
5. Select all environments (Production, Preview, Development)
6. Click "Save"

**⚠️ IMPORTANT:**
- Do NOT add `ELORA_API_KEY` to Vercel - it's only used by Supabase Edge Functions
- The frontend NEVER directly calls the Elora API
- All Elora API calls go through Supabase Edge Functions

### Step 5: Deploy to Vercel

**Option A: Deploy via Git Push** (Recommended)

Vercel automatically deploys when you push to your branch:

```bash
git add .
git commit -m "Fix dashboard API configuration"
git push origin claude/fix-dashboard-errors-VKuga
```

**Option B: Manual Deploy via Vercel CLI**

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Option C: Trigger Deploy in Vercel Dashboard**

1. Go to https://vercel.com/your-team/elora-compliance-portal
2. Click "Deployments" tab
3. Click "Redeploy" button
4. Select "Use existing Build Cache: No"
5. Click "Redeploy"

## ✅ Verification Checklist

After deployment, verify everything works:

### 1. Check Deployment Status

- [ ] Vercel deployment completed successfully
- [ ] No build errors in Vercel logs
- [ ] Environment variables are set in Vercel

### 2. Test the Application

Visit: https://elora-compliance-portal.vercel.app

- [ ] Application loads without errors
- [ ] No "Failed to Load Dashboard" error
- [ ] Login page appears (if authentication is required)

### 3. Test Dashboard (After Login)

- [ ] Dashboard loads successfully
- [ ] Customers data displays in dropdown
- [ ] Sites data displays in dropdown
- [ ] Dashboard stats show (fleet size, compliance rate, etc.)
- [ ] Vehicle table populates with data
- [ ] No console errors in browser DevTools

### 4. Test All 7 Elora API Endpoints

Open browser DevTools (F12) → Network tab and verify these requests succeed:

- [ ] `elora_customers` - Returns customer list
- [ ] `elora_sites` - Returns sites list
- [ ] `elora_dashboard` - Returns dashboard data
- [ ] `elora_vehicles` - Returns vehicles (if used)
- [ ] `elora_devices` - Returns devices (if used)
- [ ] `elora_refills` - Returns refills data (if used)
- [ ] `elora_scans` - Returns scan data (if used)

All should return HTTP 200 with JSON data.

## 🐛 Troubleshooting

### Issue: "Failed to Load Dashboard"

**Symptoms:**
- Error message: "Failed to load customers. Failed to load sites. Failed to load dashboard data."

**Solutions:**

1. **Check Vercel Environment Variables:**
   ```bash
   # Verify in Vercel dashboard that these are set:
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   ```

2. **Check Supabase Secrets:**
   ```bash
   supabase secrets list --project-ref mtjfypwrtvzhnzgatoim
   # Should show: ELORA_API_KEY
   ```

3. **Check Edge Functions are Deployed:**
   - Go to Supabase Dashboard → Edge Functions
   - Verify all 7 functions are listed and active

4. **Check Edge Function Logs:**
   ```bash
   # View logs for a specific function
   supabase functions logs elora_customers --project-ref mtjfypwrtvzhnzgatoim
   ```

5. **Check CORS Headers:**
   - Open browser DevTools → Console
   - Look for CORS errors
   - Edge functions should have proper CORS headers set

### Issue: API Returns 500 Error

**Solutions:**

1. **Check Elora API Key is Correct:**
   ```bash
   # Test the Elora API directly
   curl -H "x-api-key: TYjmdhZvL9dHZIT6O2DXVkfg9LZSv7X9" \
        https://www.elora.com.au/api/customers
   ```

2. **Redeploy Edge Functions:**
   ```bash
   ./scripts/deploy-functions.sh
   ```

3. **Check Edge Function Logs:**
   ```bash
   supabase functions logs elora_dashboard --project-ref mtjfypwrtvzhnzgatoim
   ```

### Issue: Environment Variables Not Loading

**Solutions:**

1. **Redeploy with No Cache:**
   - Go to Vercel Dashboard
   - Click "Redeploy"
   - Uncheck "Use existing Build Cache"
   - Click "Redeploy"

2. **Verify Variable Names:**
   - Must start with `VITE_` prefix for Vite to expose them
   - Check for typos in variable names

## 📊 Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Vercel)   │
└──────┬──────┘
       │
       │ VITE_SUPABASE_URL
       │ VITE_SUPABASE_ANON_KEY
       │
       ▼
┌─────────────────────┐
│  Supabase Client    │
│  (supabase-js)      │
└──────┬──────────────┘
       │
       │ supabase.functions.invoke('elora_customers')
       │
       ▼
┌─────────────────────────────┐
│  Supabase Edge Functions    │
│  (Deno Runtime)             │
│  ┌─────────────────────┐    │
│  │ elora_customers     │    │
│  │ elora_dashboard     │    │
│  │ elora_devices       │    │
│  │ elora_refills       │    │
│  │ elora_scans         │    │
│  │ elora_sites         │    │
│  │ elora_vehicles      │    │
│  └─────────────────────┘    │
└──────┬──────────────────────┘
       │
       │ x-api-key: ELORA_API_KEY (from secrets)
       │
       ▼
┌─────────────────────┐
│   Elora API         │
│   elora.com.au      │
└─────────────────────┘
```

## 🔐 Security Notes

1. **Never commit secrets to git:**
   - `.env.local` is in `.gitignore`
   - Elora API key is stored in Supabase secrets, not in code

2. **Environment variable security:**
   - `VITE_*` variables are exposed to the browser (public)
   - Only put public/anon keys in `VITE_*` variables
   - Private keys go in Supabase secrets

3. **CORS protection:**
   - Edge functions have CORS enabled for all origins (`*`)
   - Consider restricting to your domain in production

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Vercel deployment logs
3. Review Supabase Edge Function logs
4. Test APIs locally using `./scripts/test-apis.sh`

## 🎯 Quick Reference

**Supabase Project:**
- Project Ref: `mtjfypwrtvzhnzgatoim`
- URL: `https://mtjfypwrtvzhnzgatoim.supabase.co`

**Elora API:**
- Base URL: `https://www.elora.com.au/api`
- Auth: Header `x-api-key` (or query param for refills)

**Deployment Commands:**
```bash
# Set secrets
./scripts/set-secrets.sh

# Deploy functions
./scripts/deploy-functions.sh

# Test APIs
./scripts/test-apis.sh

# Verify setup
./scripts/verify-setup.sh
```
