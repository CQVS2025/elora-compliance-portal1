# 🚀 Deployment Checklist

Quick reference checklist for deploying the Elora Compliance Portal.

## 📝 Pre-Deployment Checklist

### Local Development Setup

- [ ] `.env.local` file exists with correct values
  ```bash
  cat .env.local
  # Should contain:
  # VITE_SUPABASE_URL=https://mtjfypwrtvzhnzgatoim.supabase.co
  # VITE_SUPABASE_ANON_KEY=eyJhbGci...
  ```

- [ ] Dependencies installed
  ```bash
  npm install
  ```

- [ ] Supabase CLI installed
  ```bash
  npm install -g supabase
  ```

- [ ] Run verification script
  ```bash
  ./scripts/verify-setup.sh
  ```

## 🔐 Supabase Configuration

### Configure Secrets

- [ ] Set ELORA_API_KEY secret in Supabase
  ```bash
  ./scripts/set-secrets.sh
  ```

- [ ] Verify secret is set
  ```bash
  supabase secrets list --project-ref mtjfypwrtvzhnzgatoim
  # Should show: ELORA_API_KEY
  ```

### Deploy Edge Functions

- [ ] Deploy all Supabase Edge Functions
  ```bash
  ./scripts/deploy-functions.sh
  ```

- [ ] Verify deployments in Supabase Dashboard
  - Go to: https://supabase.com/dashboard/project/mtjfypwrtvzhnzgatoim/functions
  - Check all 7 functions are listed:
    - ✅ elora_customers
    - ✅ elora_dashboard
    - ✅ elora_devices
    - ✅ elora_refills
    - ✅ elora_scans
    - ✅ elora_sites
    - ✅ elora_vehicles

### Test Edge Functions

- [ ] Test all APIs
  ```bash
  ./scripts/test-apis.sh
  ```

- [ ] All tests return 200 OK
- [ ] No error responses

## ☁️ Vercel Configuration

### Set Environment Variables

- [ ] Go to Vercel project settings
  - URL: https://vercel.com/[your-team]/elora-compliance-portal/settings/environment-variables

- [ ] Add `VITE_SUPABASE_URL`
  - Value: `https://mtjfypwrtvzhnzgatoim.supabase.co`
  - Environments: Production, Preview, Development

- [ ] Add `VITE_SUPABASE_ANON_KEY`
  - Value: Your Supabase anon key (from .env.local)
  - Environments: Production, Preview, Development

- [ ] **DO NOT** add ELORA_API_KEY to Vercel
  - ❌ This should ONLY be in Supabase secrets
  - ❌ Frontend never calls Elora API directly

### Deploy to Vercel

- [ ] Commit all changes
  ```bash
  git add .
  git commit -m "Fix dashboard API configuration and deployment"
  ```

- [ ] Push to branch
  ```bash
  git push origin claude/fix-dashboard-errors-VKuga
  ```

- [ ] Verify Vercel auto-deploys
  - Check: https://vercel.com/[your-team]/elora-compliance-portal/deployments

- [ ] Or manually trigger deploy
  - Go to Vercel Dashboard → Deployments → Redeploy
  - Uncheck "Use existing Build Cache"
  - Click "Redeploy"

## ✅ Post-Deployment Verification

### Test Production Application

- [ ] Visit: https://elora-compliance-portal.vercel.app

- [ ] Application loads without errors
  - No "Failed to Load Dashboard" error
  - No blank white screen

- [ ] Open Browser DevTools (F12)
  - No errors in Console tab
  - No failed requests in Network tab

### Test Dashboard Functionality

- [ ] Login works (if authentication required)

- [ ] Dashboard loads successfully
  - Customers dropdown populates
  - Sites dropdown populates
  - Stats cards show data

- [ ] Filter functionality works
  - Can select customer
  - Can select site
  - Can change date range

- [ ] Data displays correctly
  - Vehicle table shows vehicles
  - Charts render with data
  - No "Failed to load" errors

### Test API Endpoints in Production

Open Browser DevTools → Network tab and verify:

- [ ] `elora_customers` returns 200 with customer data
- [ ] `elora_sites` returns 200 with sites data
- [ ] `elora_dashboard` returns 200 with dashboard data
- [ ] No 500 errors
- [ ] No CORS errors

## 🐛 If Something Fails

### Dashboard shows error

1. **Check Vercel environment variables**
   ```bash
   # In Vercel Dashboard, verify:
   VITE_SUPABASE_URL=https://mtjfypwrtvzhnzgatoim.supabase.co
   VITE_SUPABASE_ANON_KEY=[your-key]
   ```

2. **Check Supabase secrets**
   ```bash
   supabase secrets list --project-ref mtjfypwrtvzhnzgatoim
   # Must show: ELORA_API_KEY
   ```

3. **Redeploy edge functions**
   ```bash
   ./scripts/deploy-functions.sh
   ```

4. **View edge function logs**
   ```bash
   supabase functions logs elora_customers --project-ref mtjfypwrtvzhnzgatoim
   ```

5. **Redeploy Vercel (no cache)**
   - Vercel Dashboard → Redeploy
   - Uncheck build cache
   - Deploy

### API returns 500 error

1. **Check Elora API key is correct**
   ```bash
   # Test Elora API directly
   curl -H "x-api-key: TYjmdhZvL9dHZIT6O2DXVkfg9LZSv7X9" \
        https://www.elora.com.au/api/customers
   ```

2. **Re-set the secret**
   ```bash
   ./scripts/set-secrets.sh
   ```

3. **Redeploy functions**
   ```bash
   ./scripts/deploy-functions.sh
   ```

### CORS errors

1. **Check edge function CORS headers**
   - Functions should have `Access-Control-Allow-Origin: *`
   - Verify in `supabase/functions/_shared/cors.ts`

2. **Redeploy functions**
   ```bash
   ./scripts/deploy-functions.sh
   ```

## 📊 Success Criteria

✅ **All checks must pass:**

1. ✅ Vercel deployment successful (green checkmark)
2. ✅ Application loads without errors
3. ✅ Dashboard displays customer data
4. ✅ Dashboard displays sites data
5. ✅ Dashboard displays stats and vehicle data
6. ✅ All 7 Elora API endpoints return 200
7. ✅ No console errors in browser DevTools
8. ✅ No CORS errors
9. ✅ Filters work correctly
10. ✅ Charts and tables render with data

## 🎯 Quick Commands Reference

```bash
# Verify local setup
./scripts/verify-setup.sh

# Set Supabase secrets
./scripts/set-secrets.sh

# Deploy all edge functions
./scripts/deploy-functions.sh

# Test all APIs
./scripts/test-apis.sh

# Deploy to Vercel via git
git add .
git commit -m "Deploy fixes"
git push origin claude/fix-dashboard-errors-VKuga
```

## 📞 Need Help?

Refer to:
- **Detailed Guide:** See `VERCEL_DEPLOYMENT.md`
- **Architecture:** See Architecture section in `VERCEL_DEPLOYMENT.md`
- **Troubleshooting:** See Troubleshooting section in `VERCEL_DEPLOYMENT.md`

---

**Project Info:**
- Supabase Project: `mtjfypwrtvzhnzgatoim`
- Supabase URL: `https://mtjfypwrtvzhnzgatoim.supabase.co`
- Vercel App: `https://elora-compliance-portal.vercel.app`
- Branch: `claude/fix-dashboard-errors-VKuga`
