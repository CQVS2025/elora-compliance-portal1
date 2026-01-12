# ELORA Fleet Compliance Portal

A comprehensive fleet management and compliance tracking system built with React and Supabase.

## 🚀 Features

- **Fleet Management**: Track vehicles, sites, and devices
- **Compliance Monitoring**: Set and monitor wash frequency targets
- **Maintenance Tracking**: Schedule and record maintenance activities
- **Real-time Notifications**: Get alerts for compliance and maintenance
- **Email Reports**: Automated scheduled reports and digests
- **Multi-tenant**: Secure data isolation with Row-Level Security
- **External API Integration**: Connects to Elora API for real-time fleet data

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- Supabase CLI (`npm install -g supabase`)
- Elora API key (for external data integration)

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd elora-compliance-portal1
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

The file already contains your Supabase credentials:
- `VITE_SUPABASE_URL`: https://mtjfypwrtvzhnzgatoim.supabase.co
- `VITE_SUPABASE_ANON_KEY`: Your anon key (already filled in)

### 3. Set Up Database

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to [Supabase SQL Editor](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/sql/new)
2. Open `supabase/migrations/20250112000001_initial_schema.sql`
3. Copy all contents and paste into SQL Editor
4. Click "Run"
5. Repeat for:
   - `supabase/migrations/20250112000002_rls_policies.sql`
   - `supabase/migrations/20250112000003_seed_test_data.sql`

#### Option B: Using Supabase CLI

```bash
supabase link --project-ref mtjfypwrtvzhnzgatoim
supabase db push
```

### 4. Deploy Edge Functions

Deploy all 21 Edge Functions to Supabase:

```bash
./scripts/deploy-all-functions.sh
```

Or deploy individually:

```bash
supabase functions deploy elora_vehicles --project-ref mtjfypwrtvzhnzgatoim
```

### 5. Set Function Environment Variables

In [Supabase Dashboard → Edge Functions → Settings](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/functions):

Add:
- `ELORA_API_KEY`: Your Elora API key

### 6. Create Test Users

1. Go to [Auth Users](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/auth/users)
2. Create a new user (e.g., `admin@heidelberg.com.au`)
3. Mark email as confirmed
4. Create user profile in SQL Editor:

```sql
-- Get the user ID from auth.users
SELECT id, email FROM auth.users;

-- Create profile
INSERT INTO user_profiles (id, company_id, email, full_name, role, is_active)
VALUES (
  'USER_ID_FROM_ABOVE',
  (SELECT id FROM companies WHERE name = 'Heidelberg Materials'),
  'admin@heidelberg.com.au',
  'Admin User',
  'admin',
  true
);
```

### 7. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## 📂 Project Structure

```
elora-compliance-portal1/
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── lib/              # Core utilities
│   │   ├── supabase.js   # Supabase client
│   │   └── AuthContext.jsx  # Auth provider
│   ├── api/              # API client
│   │   └── supabaseClient.js  # Function wrappers
│   └── hooks/            # Custom React hooks
├── supabase/
│   ├── functions/        # Edge Functions (21 total)
│   │   ├── elora_vehicles/
│   │   ├── elora_customers/
│   │   ├── ...
│   │   └── _shared/      # Shared utilities
│   └── migrations/       # Database migrations
├── scripts/
│   ├── deploy-all-functions.sh  # Deploy all functions
│   └── test-all.sh       # Test functions
└── .env.local            # Local environment variables
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Type check with TypeScript

## 📊 Database Schema

The database uses a multi-tenant architecture with the following tables:

- `companies` - Organization/client data
- `user_profiles` - Extended user information
- `compliance_targets` - Custom wash frequency targets
- `favorite_vehicles` - User bookmarks
- `maintenance_records` - Fleet maintenance history
- `notifications` - User notifications
- `notification_preferences` - Notification settings
- `email_digest_preferences` - Email digest settings
- `email_report_preferences` - Scheduled reports
- `client_branding` - White-label customization

All tables include Row-Level Security (RLS) for multi-tenant data isolation.

## 🔌 Supabase Edge Functions

21 serverless functions for backend logic:

**External API Integration:**
- `elora_vehicles`, `elora_customers`, `elora_sites`, `elora_devices`
- `elora_scans`, `elora_refills`, `elora_dashboard`, `elora_recent_activity`

**Database Operations:**
- `elora_get_favorites`, `elora_toggle_favorite`
- `elora_get_compliance_targets`, `elora_save_compliance_target`, `elora_delete_compliance_target`
- `elora_get_digest_preferences`, `elora_save_digest_preferences`

**Notifications & Reports:**
- `checkNotifications`
- `sendEmailReport`, `sendScheduledReports`

**Utilities:**
- `createHeidelbergTestUser`
- `elora_test`, `elora_test2`

## 🔐 Authentication

Uses Supabase Auth with email/password authentication. Features:

- Session management with auto-refresh
- User profiles linked to companies
- Role-based access control (admin, user, site_manager, driver)
- Password reset functionality

## 🌐 Deployment

### Frontend (Vercel/Netlify)

```bash
npm run build
# Deploy dist/ folder
```

### Edge Functions

Already deployed to Supabase using the deployment script.

### Environment Variables (Production)

Set in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📝 Development Workflow

1. Make changes to source code
2. Test locally with `npm run dev`
3. Deploy functions: `./scripts/deploy-all-functions.sh`
4. Build and deploy frontend: `npm run build`
5. Commit and push changes

## 🐛 Troubleshooting

### Functions not working

1. Check Edge Function logs in [Supabase Dashboard](https://app.supabase.com/project/mtjfypwrtvzhnzgatoim/functions)
2. Verify `ELORA_API_KEY` is set in function settings
3. Test function with `./scripts/test-all.sh`

### Database errors

1. Verify migrations ran successfully
2. Check RLS policies are enabled
3. Confirm user has proper company_id in user_profiles

### Auth issues

1. Ensure user profile exists in `user_profiles`
2. Check user's `company_id` is valid
3. Verify email is confirmed in Supabase Auth

## 📚 Documentation

- [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) - Migration summary
- [Database Schema Docs](./supabase/migrations/)
- [Supabase Documentation](https://supabase.com/docs)

## 🤝 Support

For issues or questions:
1. Check Supabase logs and dashboard
2. Review function code in `supabase/functions/`
3. Verify database schema in `supabase/migrations/`

## 📄 License

Private project - All rights reserved

---

**Built with:**
- ⚛️ React 18
- 🔥 Supabase (Database, Auth, Functions)
- 🎨 Tailwind CSS
- 📊 Recharts
- 🗺️ Leaflet Maps
