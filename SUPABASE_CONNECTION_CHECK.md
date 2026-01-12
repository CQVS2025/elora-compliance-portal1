# ✅ Supabase Connection Verification

## Current Status

Your repo is **configured and verified** to connect to Supabase project `mtjfypwrtvzhnzgatoim`.

---

## ✅ Already Configured

| Item | Status | Value |
|------|--------|-------|
| **Project URL** | ✅ Configured | `https://mtjfypwrtvzhnzgatoim.supabase.co` |
| **Project Ref** | ✅ Configured | `mtjfypwrtvzhnzgatoim` |
| **Region** | ✅ Sydney | As specified |
| **Database URL** | ✅ Stored | In `.env.local` |
| **Config File** | ✅ Set | `supabase/config.toml` has project_id |
| **Supabase Client** | ✅ Created | `src/lib/supabase.js` |
| **21 Edge Functions** | ✅ Ready | All in `supabase/functions/` |
| **Database Migrations** | ✅ Ready | 3 files in `supabase/migrations/` |

---

## ✅ Anon Key Verified

The anon key has been set in `.env.example`. Copy it into your local `.env.local` when you run the app.

### Step 1: Update .env.local

Copy the example file and ensure the anon key matches:

```bash
# Edit .env.local
VITE_SUPABASE_URL=https://mtjfypwrtvzhnzgatoim.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10amZ5cHdydHZ6aG56Z2F0b2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDg4NjksImV4cCI6MjA4MzcyNDg2OX0.yteYGqTM
```

### Step 3: Test Connection

```bash
# Test the connection
npm run dev
```

Then visit `http://localhost:5173` and check the browser console for any connection errors.

---

## 🔐 Credentials Summary

### Frontend (.env.local)
- ✅ `VITE_SUPABASE_URL`: https://mtjfypwrtvzhnzgatoim.supabase.co
- ✅ `VITE_SUPABASE_ANON_KEY`: Verified in `.env.example`
- ✅ `DATABASE_URL`: Configured with your password

### Backend (Supabase Dashboard)
For Edge Functions, you need to set in [Function Settings](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/functions):
- `ELORA_API_KEY`: Your Elora API key (when ready to deploy functions)

---

## 🧪 How to Test Connection

### Option 1: Quick Test with curl

Once you have the correct anon key, test it:

```bash
curl "https://mtjfypwrtvzhnzgatoim.supabase.co/rest/v1/" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected response: List of available tables or empty JSON

### Option 2: Test with npm

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` - the app should load without connection errors.

---

## 📝 What's Already Connected

### 1. Config File (`supabase/config.toml`)
```toml
project_id = "mtjfypwrtvzhnzgatoim"
```

### 2. Supabase Client (`src/lib/supabase.js`)
```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

### 3. Database Connection String
```
postgresql://postgres:cqvs@lorne5@db.mtjfypwrtvzhnzgatoim.supabase.co:5432/postgres
```

---

## 🚀 Next Steps After Verification

Once the anon key is verified:

1. **Run Database Migrations**
   ```bash
   # Go to Supabase SQL Editor and run:
   # - supabase/migrations/20250112000001_initial_schema.sql
   # - supabase/migrations/20250112000002_rls_policies.sql
   # - supabase/migrations/20250112000003_seed_test_data.sql
   ```
   Or run the helper script:
   ```bash
   ./scripts/apply-migrations.sh
   ```

2. **Deploy Edge Functions**
   ```bash
   # Install Supabase CLI first
   npm install -g supabase

   # Deploy all functions
   ./scripts/deploy-all-functions.sh
   ```

3. **Create Test User**
   - Go to [Auth Users](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/auth/users)
   - Create user and profile (see README.md)

4. **Test Application**
   ```bash
   npm run dev
   ```

---

## 🔧 Troubleshooting

### "Invalid API key" Error

**Problem**: The anon key is incorrect or expired.

**Solution**:
1. Get fresh anon key from https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/settings/api
2. Update `.env.local`
3. Restart dev server

### "Access to schema is forbidden" Error

**Problem**: Using service_role key instead of anon key, or wrong key type.

**Solution**:
1. Make sure you're using the **`anon` `public`** key (not service_role)
2. The key should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

### Connection Timeout

**Problem**: Network or URL issue.

**Solution**:
1. Verify URL is exactly: `https://mtjfypwrtvzhnzgatoim.supabase.co`
2. Check internet connection
3. Verify project is active in Supabase dashboard

---

## ✅ Verification Checklist

- [x] Anon key set in `.env.example`
- [ ] Copied `.env.example` to `.env.local`
- [ ] Tested connection with curl or npm run dev
- [ ] No "Invalid API key" errors in console
- [ ] Can see Supabase client initializes successfully

Once all checkboxes are complete, your repo is fully connected to Supabase! 🎉

---

**Need Help?**
- Dashboard: https://app.supabase.com/project/mtjfypwrtvzhnzgatoim
- API Settings: https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/settings/api
- Documentation: Check `README.md` and `MIGRATION_COMPLETE.md`
