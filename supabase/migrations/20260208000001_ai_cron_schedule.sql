-- AI Insights Automated Cron - Phase 2
-- Runs daily at 6:00 AM Australia Adelaide (19:30 UTC)
--
-- PREREQUISITE: Store these secrets in Supabase Vault before running this migration:
--   1. project_url:  select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'ai_cron_project_url');
--   2. service_key:  select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'ai_cron_service_key');
--   3. cron_secret:  select vault.create_secret('YOUR_CRON_SECRET', 'ai_cron_secret');  -- optional, for x-cron-secret header
--
-- Alternatively, use Supabase Dashboard > Integrations > Cron: create job, type "Supabase Edge Function",
-- select run-ai-cron, schedule "30 19 * * *" (6am Adelaide), add header x-cron-secret if using CRON_SECRET.

-- Enable extensions (already enabled on Supabase hosted)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Schedule run-ai-cron daily at 19:30 UTC = 6:00 AM Adelaide (ACST/ACDT)
-- Only creates job if vault secrets exist (avoid migration failure)
do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'ai_cron_project_url')
     and exists (select 1 from vault.decrypted_secrets where name = 'ai_cron_service_key')
     and exists (select 1 from vault.decrypted_secrets where name = 'ai_cron_secret') then
    perform cron.schedule(
      'run-ai-insights-daily',
      '30 19 * * *',
      $croncmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'ai_cron_project_url') || '/functions/v1/run-ai-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ai_cron_service_key'),
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ai_cron_secret')
        ),
        body := '{}'::jsonb
      ) as request_id;
      $croncmd$
    );
    raise notice 'Cron job run-ai-insights-daily scheduled for 6:00 AM Adelaide (19:30 UTC)';
  else
    raise notice 'Skipping cron schedule: create vault secrets ai_cron_project_url, ai_cron_service_key, and ai_cron_secret first';
  end if;
end
$$;
